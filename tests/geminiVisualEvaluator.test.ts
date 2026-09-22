import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { createGeminiImageQualityEvaluator, imageAiQualityJsonSchema } from '../src/qc/geminiVisualEvaluator.js';
import type { ImageCandidate } from '../src/images/types.js';
import { slideFixture } from './regression/fixtures.js';

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));

function input() {
  const slide = slideFixture('image_text');
  slide.visual = { needed: true, type: 'diagram', concept: 'neural network layers', query_en: 'neural network layers diagram', placement: 'right' };
  const image: ImageCandidate & { bytes: Uint8Array } = {
    provider: 'wikimedia', providerId: 'network', sourceUrl: 'https://commons.wikimedia.org/wiki/File:network.png',
    imageUrl: 'https://upload.wikimedia.org/network.png', mimeType: 'image/png', width: 1, height: 1,
    altText: 'neural network layers', author: 'Author', license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', query: 'neural network layers diagram',
    concept: 'neural network layers', bytes: png,
  };
  return { slide, image };
}

const acceptedReport = {
  kind: 'image', decision: 'accept', confidence: 'high', relevance: 'strong', educationalValue: 'explains',
  genericStock: false, containsText: false, textLegibility: 'not_applicable',
  observedElements: ['input layer', 'hidden layer', 'output layer'], mismatch: null,
  reason: 'The diagram directly shows the planned neural network structure.',
};

test('Gemini evaluator sends image bytes and slide context, then validates the report', async () => {
  let requestBody: Record<string, unknown> | undefined;
  const fetchImpl: typeof fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(acceptedReport) }] } }] });
  };
  const evaluate = createGeminiImageQualityEvaluator({ apiKey: 'test-key', model: 'gemini-test', fetchImpl });
  assert.equal((await evaluate(input()) as { decision: string }).decision, 'accept');
  const serialized = JSON.stringify(requestBody);
  assert.match(serialized, /neural network layers/);
  assert.ok(serialized.includes(Buffer.from(png).toString('base64')));
  assert.deepEqual(Object.keys(imageAiQualityJsonSchema.properties), imageAiQualityJsonSchema.required);
});

test('Gemini evaluator rejects malformed model output and unsafe configuration', async () => {
  assert.throws(() => createGeminiImageQualityEvaluator({ apiKey: '', model: 'gemini-test' }), /GEMINI_API_KEY/);
  assert.throws(() => createGeminiImageQualityEvaluator({ apiKey: 'key', model: '../model' }), /bare model identifier/);
  const fetchImpl: typeof fetch = async () => Response.json({ candidates: [{ content: { parts: [{ text: '{"decision":"accept"}' }] } }] });
  const evaluate = createGeminiImageQualityEvaluator({ apiKey: 'test-key', model: 'gemini-test', fetchImpl });
  await assert.rejects(evaluate(input()));
});

test('Gemini evaluator does not expose response bodies in HTTP errors', async () => {
  const fetchImpl: typeof fetch = async () => new Response('secret upstream details', { status: 429 });
  const evaluate = createGeminiImageQualityEvaluator({ apiKey: 'test-key', model: 'gemini-test', fetchImpl });
  await assert.rejects(evaluate(input()), /HTTP 429/);
});
