import type { ImageCandidate, ImageSearchProvider, ImageSearchQuery } from './types.js';

type Fetcher = typeof fetch;
type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
}
function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
function positiveInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}
function httpsUrl(value: unknown, hosts: readonly string[]): string | null {
  const raw = string(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && hosts.includes(url.hostname.toLowerCase()) ? url.toString() : null;
  } catch { return null; }
}
function plainText(value: unknown): string | null {
  const raw = string(value);
  if (!raw) return null;
  const cleaned = raw.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
  return cleaned || null;
}
function metadata(value: unknown): string | null {
  return plainText(object(value)?.value);
}
async function readJson(response: Response, provider: string): Promise<JsonObject> {
  if (!response.ok) throw new Error(`${provider} search failed with HTTP ${response.status}`);
  const value: unknown = await response.json();
  const result = object(value);
  if (!result) throw new Error(`${provider} returned an invalid JSON object`);
  return result;
}

/** Unsplash search metadata; actual download must be tracked and credited separately. */
export function createUnsplashProvider(options: { accessKey?: string; fetchImpl?: Fetcher } = {}): ImageSearchProvider {
  const accessKey = options.accessKey ?? process.env.UNSPLASH_ACCESS_KEY ?? '';
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    id: 'unsplash',
    async search(query: ImageSearchQuery): Promise<readonly ImageCandidate[]> {
      if (!accessKey.trim()) return [];
      if (query.kind !== 'photo') return [];
      const url = new URL('https://api.unsplash.com/search/photos');
      url.searchParams.set('query', query.queryEn);
      url.searchParams.set('per_page', '15');
      url.searchParams.set('content_filter', 'high');
      url.searchParams.set('orientation', query.placement === 'supporting' ? 'squarish' : 'landscape');
      const response = await fetchImpl(url, { headers: { Authorization: `Client-ID ${accessKey}` }, redirect: 'error', signal: AbortSignal.timeout(8000) });
      const payload = await readJson(response, 'Unsplash');
      if (!Array.isArray(payload.results)) return [];
      const candidates: ImageCandidate[] = [];
      for (const raw of payload.results) {
        const item = object(raw);
        if (!item) continue;
        const links = object(item.links); const urls = object(item.urls); const user = object(item.user);
        const id = string(item.id); const sourceUrl = httpsUrl(links?.html, ['unsplash.com']);
        const rawImageUrl = httpsUrl(urls?.regular, ['images.unsplash.com']);
        const downloadLocation = httpsUrl(links?.download_location, ['api.unsplash.com']);
        const author = string(user?.name); const authorUrl = httpsUrl(object(user?.links)?.html, ['unsplash.com']);
        const width = positiveInt(item.width); const height = positiveInt(item.height);
        const altText = plainText(item.alt_description) ?? plainText(item.description);
        if (!id || !sourceUrl || !rawImageUrl || !downloadLocation || !author || !authorUrl || !width || !height || !altText) continue;
        const imageUrl = new URL(rawImageUrl);
        imageUrl.searchParams.set('fm', 'jpg');
        candidates.push({ provider: 'unsplash', providerId: id, sourceUrl, imageUrl: imageUrl.toString(), mimeType: 'image/jpeg', width, height,
          altText, author, authorUrl, license: 'Unsplash License', licenseUrl: 'https://unsplash.com/license', downloadLocation,
          query: query.queryEn, concept: query.concept });
      }
      return candidates;
    },
  };
}

/** Wikimedia Commons file search with per-file license and creator metadata. */
export function createWikimediaProvider(options: { fetchImpl?: Fetcher; userAgent?: string } = {}): ImageSearchProvider {
  const fetchImpl = options.fetchImpl ?? fetch;
  const userAgent = options.userAgent ?? 'SlideX/0.1 (educational presentation renderer)';
  return {
    id: 'wikimedia',
    async search(query: ImageSearchQuery): Promise<readonly ImageCandidate[]> {
      const url = new URL('https://commons.wikimedia.org/w/api.php');
      for (const [key, value] of Object.entries({ action: 'query', generator: 'search', gsrsearch: query.queryEn, gsrnamespace: '6', gsrlimit: '15', prop: 'imageinfo', iiprop: 'url|mime|size|extmetadata', iiurlwidth: '1600', format: 'json', formatversion: '2' })) url.searchParams.set(key, value);
      const response = await fetchImpl(url, { headers: { 'User-Agent': userAgent }, redirect: 'error', signal: AbortSignal.timeout(8000) });
      const payload = await readJson(response, 'Wikimedia');
      const pages = object(payload.query)?.pages;
      if (!Array.isArray(pages)) return [];
      const candidates: ImageCandidate[] = [];
      for (const raw of pages) {
        const page = object(raw);
        const info = Array.isArray(page?.imageinfo) ? object(page.imageinfo[0]) : null;
        if (!page || !info) continue;
        const id = positiveInt(page.pageid); const title = string(page.title);
        const extension = object(info.extmetadata);
        const license = metadata(extension?.LicenseShortName);
        const licenseUrl = httpsUrl(metadata(extension?.LicenseUrl), ['creativecommons.org', 'www.creativecommons.org']);
        const author = metadata(extension?.Artist);
        const isPublicDomain = license === 'Public domain' || /^CC0(?: 1\.0)?$/i.test(license ?? '');
        const isAttribution = license !== null && /^CC BY(?: \d+(?:\.\d+)?)?$/i.test(license);
        if (!isPublicDomain && !isAttribution) continue;
        if (isAttribution && (!author || !licenseUrl)) continue;
        const mimeType = string(info.thumbmime) ?? string(info.mime);
        const imageUrl = httpsUrl(info.thumburl ?? info.url, ['upload.wikimedia.org']);
        const sourceUrl = httpsUrl(info.descriptionurl, ['commons.wikimedia.org']);
        const width = positiveInt(info.thumbwidth) ?? positiveInt(info.width);
        const height = positiveInt(info.thumbheight) ?? positiveInt(info.height);
        if (!id || !title || !imageUrl || !sourceUrl || !width || !height || !mimeType || !['image/jpeg', 'image/png'].includes(mimeType)) continue;
        candidates.push({ provider: 'wikimedia', providerId: String(id), sourceUrl, imageUrl, mimeType, width, height,
          altText: title.replace(/^File:/i, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '), title,
          author: author ?? 'Wikimedia Commons', license: license!, ...(licenseUrl ? { licenseUrl } : {}), query: query.queryEn, concept: query.concept });
      }
      return candidates;
    },
  };
}
