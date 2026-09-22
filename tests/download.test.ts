import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { downloadImage } from '../src/images/download.js';
import type { ImageCandidate } from '../src/images/types.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const candidate: ImageCandidate = { provider: 'wikimedia', providerId: '42', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Test.png', imageUrl: 'https://upload.wikimedia.org/test.png', mimeType: 'image/png', width: 1, height: 1, altText: 'test', author: 'Author', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', query: 'test', concept: 'test' };
const pngResponse = (): Response => new Response(new Blob([new Uint8Array(png)]), { headers: { 'content-type': 'image/png', 'content-length': String(png.length) } });

test('download verifies format and dimensions, then returns the actual bytes', async () => {
  const result = await downloadImage(candidate, { fetchImpl: async () => pngResponse(), minWidth: 1, minHeight: 1 });
  assert.equal(result.width, 1);
  assert.deepEqual(result.bytes, new Uint8Array(png));
});

test('download rejects low-resolution images, untrusted hosts and MIME mismatch', async () => {
  await assert.rejects(() => downloadImage(candidate, { fetchImpl: async () => pngResponse() }), /resolution is too small/);
  await assert.rejects(() => downloadImage({ ...candidate, imageUrl: 'https://evil.test/test.png' }, { fetchImpl: async () => pngResponse(), minWidth: 1, minHeight: 1 }), /trusted host/);
  await assert.rejects(() => downloadImage({ ...candidate, mimeType: 'image/jpeg' }, { fetchImpl: async () => pngResponse(), minWidth: 1, minHeight: 1 }), /MIME does not match/);
});

test('download enforces byte limit before reading body', async () => {
  const fetchImpl: typeof fetch = async () => new Response(new Blob([new Uint8Array(png)]), { headers: { 'content-type': 'image/png', 'content-length': String(9 * 1024 * 1024) } });
  await assert.rejects(() => downloadImage(candidate, { fetchImpl, minWidth: 1, minHeight: 1 }), /8 MiB limit/);
});

test('Unsplash download calls the tracking endpoint after verified bytes', async () => {
  const calls: string[] = [];
  const unsplash: ImageCandidate = { ...candidate, provider: 'unsplash', providerId: 'photo-1', sourceUrl: 'https://unsplash.com/photos/photo-1', imageUrl: 'https://images.unsplash.com/photo-1', authorUrl: 'https://unsplash.com/@author', downloadLocation: 'https://api.unsplash.com/photos/photo-1/download', license: 'Unsplash License' };
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push(String(input));
    if (String(input).includes('/download')) {
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Client-ID test-key');
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }
    return pngResponse();
  };
  await downloadImage(unsplash, { fetchImpl, unsplashAccessKey: 'test-key', minWidth: 1, minHeight: 1 });
  assert.deepEqual(calls, ['https://images.unsplash.com/photo-1', 'https://api.unsplash.com/photos/photo-1/download']);
});
