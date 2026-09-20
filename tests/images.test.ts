import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dedupeImages, imageBytesFromDataUri, imageIdentity } from '../src/images/dedupe.js';
import { scoreImageRelevance } from '../src/images/relevance.js';
import { createImageSearchQuery, searchVisual } from '../src/images/search.js';
import type { ImageCandidate, ImageSearchQuery } from '../src/images/types.js';

const visual = { needed: true, type: 'photo' as const, concept: 'student using an AI assistant in a classroom', query_en: 'student AI assistant classroom', placement: 'right' as const };
const candidate = (overrides: Partial<ImageCandidate> = {}): ImageCandidate => ({
  provider: 'fixture', providerId: 'image-1', sourceUrl: 'https://example.test/source/image-1', imageUrl: 'https://example.test/image-1.jpg', mimeType: 'image/jpeg', width: 1600, height: 900,
  altText: 'student using an AI assistant in classroom', query: visual.query_en, concept: visual.concept, ...overrides,
});

test('image search uses visual plan and never invents a query', async () => {
  let received: ImageSearchQuery | undefined;
  const provider = { id: 'fixture', search: async (query: ImageSearchQuery) => { received = query; return [candidate()]; } };
  const results = await searchVisual(provider, visual);
  assert.equal(results.length, 1);
  assert.equal(received?.queryEn, visual.query_en);
  assert.equal(createImageSearchQuery({ ...visual, needed: false }), null);
});

test('image search rejects an incomplete requested visual', () => {
  assert.throws(() => createImageSearchQuery({ ...visual, query_en: ' ' }), /non-empty concept, query_en and type/);
});

test('image search drops candidates from a different provider namespace', async () => {
  const provider = { id: 'fixture', search: async () => [candidate(), candidate({ provider: 'other', providerId: 'other-1' })] };
  const results = await searchVisual(provider, visual);
  assert.deepEqual(results.map((item) => item.providerId), ['image-1']);
});

test('relevance accepts a semantically matching image and rejects generic stock', () => {
  const query = createImageSearchQuery(visual)!;
  const relevant = scoreImageRelevance(candidate(), query);
  assert.equal(relevant.accepted, true);
  assert.ok(relevant.matchedTerms.includes('classroom'));
  const generic = scoreImageRelevance(candidate({ altText: 'generic businessman with laptop' }), query);
  assert.equal(generic.accepted, false);
  assert.match(generic.reason ?? '', /Generic stock pattern/);
});

test('dedupe uses provider identity before downloading bytes', () => {
  const unique = dedupeImages([candidate(), candidate({ imageUrl: 'https://cdn.example.test/other.jpg' }), candidate({ providerId: 'image-2' })]);
  assert.deepEqual(unique.map((item) => item.providerId), ['image-1', 'image-2']);
  assert.equal(imageIdentity(candidate()), 'provider:fixture:image-1');
});

test('dedupe falls back to SHA-256 for provider-less binary assets', () => {
  const bytes = imageBytesFromDataUri('data:image/png;base64,AAECAw==');
  const first = candidate({ provider: '', providerId: '', bytes });
  const second = candidate({ provider: '', providerId: '', bytes: new Uint8Array(bytes) });
  assert.equal(imageIdentity(first), imageIdentity(second));
  assert.equal(dedupeImages([first, second]).length, 1);
});
import { selectBestImage } from '../src/images/selection.js';

test('selection deduplicates and returns the highest relevant candidate', () => {
  const query = createImageSearchQuery(visual)!;
  const weaker = candidate({ providerId: 'image-2', altText: 'student in classroom' });
  const selected = selectBestImage([weaker, candidate(), candidate()], query);
  assert.equal(selected.candidate?.providerId, 'image-1');
  assert.equal(selected.reports.length, 2);
});

test('selection returns null when all candidates are generic or irrelevant', () => {
  const query = createImageSearchQuery(visual)!;
  const selected = selectBestImage([candidate({ altText: 'generic businessman with laptop' }), candidate({ providerId: 'image-2', altText: 'mountain landscape' })], query);
  assert.equal(selected.candidate, null);
});
