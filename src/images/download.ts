import type { ImageCandidate } from './types.js';

type Fetcher = typeof fetch;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function trustedUrl(raw: string, host: string): URL {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== host) throw new Error(`Image URL must use trusted host ${host}`);
  return url;
}

function dimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mimeType === 'image/png') {
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (bytes.length < 33 || !signature.every((value, index) => bytes[index] === value) || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR') throw new Error('Invalid PNG signature or IHDR');
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mimeType === 'image/jpeg') {
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Invalid JPEG signature');
    let offset = 2;
    while (offset + 4 < bytes.length) {
      if (bytes[offset] !== 0xff) throw new Error('Invalid JPEG segment');
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === undefined || marker === 0xda || marker === 0xd9) break;
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) throw new Error('Invalid JPEG segment length');
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        if (length < 7) throw new Error('Invalid JPEG dimensions');
        return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
      }
      offset += length;
    }
    throw new Error('JPEG has no dimensions');
  }
  throw new Error(`Unsupported image MIME type: ${mimeType}`);
}

async function boundedBytes(response: Response): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) throw new Error('Image exceeds 8 MiB limit');
  if (!response.body) throw new Error('Image response has no body');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) throw new Error('Image exceeds 8 MiB limit');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** Download a provider result after search and relevance checks. Never follows redirects. */
export async function downloadImage(candidate: ImageCandidate, options: { fetchImpl?: Fetcher; unsplashAccessKey?: string; minWidth?: number; minHeight?: number } = {}): Promise<ImageCandidate> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const host = candidate.provider === 'wikimedia' ? 'upload.wikimedia.org' : candidate.provider === 'unsplash' ? 'images.unsplash.com' : null;
  if (!host) throw new Error(`Unsupported image provider: ${candidate.provider}`);
  const url = trustedUrl(candidate.imageUrl, host);
  if (!candidate.providerId || !candidate.license || !candidate.author) throw new Error('Image provenance is incomplete');
  trustedUrl(candidate.sourceUrl, candidate.provider === 'wikimedia' ? 'commons.wikimedia.org' : 'unsplash.com');
  if (candidate.provider === 'unsplash' && (!candidate.authorUrl || !candidate.downloadLocation)) throw new Error('Unsplash attribution or tracking URL is missing');
  if (candidate.provider === 'wikimedia' && /^CC BY\b/i.test(candidate.license) && !candidate.licenseUrl) throw new Error('Wikimedia attribution license URL is missing');
  const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Image download failed with HTTP ${response.status}`);
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  if (contentType !== candidate.mimeType || !['image/jpeg', 'image/png'].includes(candidate.mimeType)) throw new Error('Image response MIME does not match candidate');
  const bytes = await boundedBytes(response);
  const actual = dimensions(bytes, candidate.mimeType);
  if (actual.width < (options.minWidth ?? 400) || actual.height < (options.minHeight ?? 225)) throw new Error('Image resolution is too small for PPTX');
  if (candidate.provider === 'unsplash') {
    const key = options.unsplashAccessKey ?? process.env.UNSPLASH_ACCESS_KEY ?? '';
    if (!key.trim()) throw new Error('Unsplash download tracking needs UNSPLASH_ACCESS_KEY');
    const trackingUrl = trustedUrl(candidate.downloadLocation!, 'api.unsplash.com');
    const tracking = await fetchImpl(trackingUrl, { headers: { Authorization: `Client-ID ${key}` }, redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!tracking.ok) throw new Error(`Unsplash download tracking failed with HTTP ${tracking.status}`);
  }
  return { ...candidate, width: actual.width, height: actual.height, bytes };
}
