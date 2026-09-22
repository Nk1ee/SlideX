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

test('resolver respects provider priority before comparing fallback scores', async () => {
  const preferred: ImageSearchProvider = { id: 'wikimedia', search: async () => [{ ...image('preferred'), altText: 'student classroom' }] };
  const fallback: ImageSearchProvider = { id: 'wikimedia-fallback', search: async () => [{ ...image('fallback'), provider: 'wikimedia-fallback', altText: 'student AI classroom' }] };
  const resolve = createImageResolver({ providers: [preferred, fallback], fetchImpl, minWidth: 1, minHeight: 1 });
  assert.equal((await resolve(slide()))?.providerId, 'preferred');
});

test('resolver tries the next candidate after an AI quality rejection', async () => {
  const provider: ImageSearchProvider = { id: 'wikimedia', search: async () => [image('one'), image('two')] };
  const checked: string[] = [];
  const issues: string[] = [];
  const resolve = createImageResolver({
    providers: [provider], fetchImpl, minWidth: 1, minHeight: 1,
    imageQualityEvaluator: async ({ image: candidate }) => {
      checked.push(candidate.providerId);
      const accepted = candidate.providerId === 'two';
      return {
        kind: 'image', decision: accepted ? 'accept' : 'reject', confidence: 'high',
        relevance: accepted ? 'strong' : 'none', educationalValue: accepted ? 'supports' : 'decorative',
        genericStock: false, containsText: false, textLegibility: 'not_applicable',
        observedElements: ['classroom'], mismatch: accepted ? null : 'The image does not show the planned AI concept.',
        reason: accepted ? 'The image supports the slide.' : 'The image is unrelated.',
      };
    },
    onIssue: (issue) => issues.push(issue.reason),
  });
  assert.equal((await resolve(slide()))?.providerId, 'two');
  assert.deepEqual(checked, ['one', 'two']);
  assert.ok(issues.includes('AI image quality check rejected candidate'));
});

test('resolver fails closed when AI asks for review or returns an invalid report', async () => {
  const provider: ImageSearchProvider = { id: 'wikimedia', search: async () => [image('one')] };
  const reviewIssues: string[] = [];
  const reviewResolver = createImageResolver({
    providers: [provider], fetchImpl, minWidth: 1, minHeight: 1,
    imageQualityEvaluator: async () => ({
      kind: 'image', decision: 'review', confidence: 'low', relevance: 'uncertain', educationalValue: 'uncertain',
      genericStock: false, containsText: false, textLegibility: 'not_applicable', observedElements: ['unclear object'],
      mismatch: 'The subject is ambiguous.', reason: 'Manual review is required.',
    }),
    onIssue: (issue) => reviewIssues.push(issue.reason),
  });
  assert.equal(await reviewResolver(slide()), null);
  assert.ok(reviewIssues.includes('AI image quality check requires review'));

  const invalidIssues: string[] = [];
  const invalidResolver = createImageResolver({
    providers: [provider], fetchImpl, minWidth: 1, minHeight: 1,
    imageQualityEvaluator: async () => ({ decision: 'accept' }),
    onIssue: (issue) => invalidIssues.push(issue.reason),
  });
  assert.equal(await invalidResolver(slide()), null);
  assert.ok(invalidIssues.includes('AI image quality check failed'));
});
