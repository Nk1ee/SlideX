import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createUnsplashProvider, createWikimediaProvider } from '../src/images/providers.js';
import type { ImageSearchQuery } from '../src/images/types.js';

const query: ImageSearchQuery = { queryEn: 'student AI classroom', concept: 'student using AI in classroom', kind: 'photo', placement: 'right' };
const json = (payload: unknown, status = 200): Response => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });

test('Unsplash searches the visual query and preserves author, source and tracking URL', async () => {
  let requested: URL | undefined;
  let auth = '';
  const fetchImpl: typeof fetch = async (input, init) => {
    requested = new URL(String(input)); auth = new Headers(init?.headers).get('Authorization') ?? '';
    return json({ results: [{ id: 'photo-1', width: 1600, height: 900, alt_description: 'student AI classroom',
      urls: { regular: 'https://images.unsplash.com/photo-1?ixid=abc' },
      links: { html: 'https://unsplash.com/photos/photo-1', download_location: 'https://api.unsplash.com/photos/photo-1/download' },
      user: { name: 'Photographer', links: { html: 'https://unsplash.com/@photographer' } } }] });
  };
  const results = await createUnsplashProvider({ accessKey: 'test-key', fetchImpl }).search(query);
  assert.equal(requested?.searchParams.get('query'), query.queryEn);
  assert.equal(auth, 'Client-ID test-key');
  assert.equal(results.length, 1);
  assert.equal(results[0]?.author, 'Photographer');
  assert.equal(results[0]?.downloadLocation, 'https://api.unsplash.com/photos/photo-1/download');
  assert.match(results[0]?.imageUrl ?? '', /ixid=abc/);
  assert.equal(results[0]?.license, 'Unsplash License');
});

test('Unsplash needs an access key and rejects incomplete or untrusted metadata', async () => {
  let called = false;
  const fetchImpl: typeof fetch = async () => { called = true; return json({ results: [
    { id: 'bad', width: 1200, height: 800, alt_description: 'student AI classroom', urls: { regular: 'https://evil.test/photo.jpg' }, links: { html: 'https://unsplash.com/photos/bad', download_location: 'https://api.unsplash.com/photos/bad/download' }, user: { name: 'A', links: { html: 'https://unsplash.com/@a' } } },
  ] }); };
  assert.deepEqual(await createUnsplashProvider({ accessKey: '', fetchImpl }).search(query), []);
  assert.equal(called, false);
  assert.deepEqual(await createUnsplashProvider({ accessKey: 'test-key', fetchImpl }).search(query), []);
});

test('Wikimedia accepts a licensed file and skips a file with missing license', async () => {
  let requested: URL | undefined;
  const fetchImpl: typeof fetch = async (input) => {
    requested = new URL(String(input));
    return json({ query: { pages: [
      { pageid: 42, title: 'File:Student_AI_classroom.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/image.jpg', thumbmime: 'image/jpeg', thumbwidth: 1200, thumbheight: 800, descriptionurl: 'https://commons.wikimedia.org/wiki/File:Student_AI_classroom.jpg', extmetadata: { Artist: { value: '<a href="/wiki/User:Example">Example</a>' }, LicenseShortName: { value: 'CC BY 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by/4.0/' } } }] },
      { pageid: 44, title: 'File:Sharealike.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/sa.jpg', thumbmime: 'image/jpeg', thumbwidth: 1200, thumbheight: 800, descriptionurl: 'https://commons.wikimedia.org/wiki/File:Sharealike.jpg', extmetadata: { Artist: { value: 'Author' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'https://creativecommons.org/licenses/by-sa/4.0/' } } }] },
      { pageid: 43, title: 'File:Unlicensed.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/x.jpg', thumbmime: 'image/jpeg', thumbwidth: 1200, thumbheight: 800, descriptionurl: 'https://commons.wikimedia.org/wiki/File:Unlicensed.jpg', extmetadata: {} }] },
    ] } });
  };
  const results = await createWikimediaProvider({ fetchImpl }).search(query);
  assert.equal(requested?.searchParams.get('gsrnamespace'), '6');
  assert.equal(requested?.searchParams.get('gsrsearch'), query.queryEn);
  assert.equal(results.length, 1);
  assert.equal(results[0]?.providerId, '42');
  assert.equal(results[0]?.author, 'Example');
  assert.equal(results[0]?.license, 'CC BY 4.0');
  assert.equal(results[0]?.altText, 'Student AI classroom');
});

test('provider HTTP errors are explicit', async () => {
  const fetchImpl: typeof fetch = async () => json({ error: 'rate limited' }, 429);
  await assert.rejects(() => createWikimediaProvider({ fetchImpl }).search(query), /Wikimedia search failed with HTTP 429/);
});
