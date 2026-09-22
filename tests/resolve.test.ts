import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { createImageResolver } from '../src/images/resolve.js';
import type { ImageCandidate, ImageSearchProvider } from '../src/images/types.js';
import { slideFixture } from './regression/fixtures.js';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const visual = { needed: true, type: 'photo' as const, concept: 'student AI classroom', query_en: 'student AI classroom', placement: 'right' as const };
const image = (id: string): ImageCandidate => ({ provider: 'wikimedia', providerId: id, sourceUrl: `https://commons.wikimedia.org/wiki/File:${id}.png`, imageUrl: `https://upload.wikimedia.org/${id}.png`, mimeType: 'image/png', width: 1, height: 1, altText: 'student AI classroom', author: 'Author', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', query: visual.query_en, concept: visual.concept });
const slide = () => { const result = slideFixture('image_text'); result.visual = visual; return result; };
const fetchImpl: typeof fetch = async () => new Response(new Blob([new Uint8Array(png)]), { headers: { 'content-type': 'image/png' } });

test('resolver returns a verified image and blocks reuse across slides', async () => {
  const provider: ImageSearchProvider = { id: 'wikimedia', search: async () => [image('one')] };
  const resolve = createImageResolver({ providers: [provider], fetchImpl, minWidth: 1, minHeight: 1 });
  assert.deepEqual((await resolve(slide()))?.bytes, new Uint8Array(png));
  assert.equal(await resolve(slide()), null);
});

test('resolver falls through a failed candidate without inventing an image', async () => {
  const provider: ImageSearchProvider = { id: 'wikimedia', search: async () => [image('one'), image('two')] };
  const issues: string[] = [];
  const fetchWithFailure: typeof fetch = async (input) => String(input).includes('one.png') ? new Response('bad', { status: 500 }) : fetchImpl(input);
  const resolve = createImageResolver({ providers: [provider], fetchImpl: fetchWithFailure, minWidth: 1, minHeight: 1, onIssue: (issue) => issues.push(issue.reason) });
  assert.equal((await resolve(slide()))?.providerId, 'two');
  assert.ok(issues.includes('Image download or verification failed'));
});
