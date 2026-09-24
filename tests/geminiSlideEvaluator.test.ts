import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { test } from 'node:test';
import { createGeminiSlideQualityEvaluator, slideAiQualityJsonSchema } from '../src/qc/geminiSlideEvaluator.js';
import { slideAiQualityReportSchema } from '../src/qc/visualAi.js';
import { slideFixture } from './regression/fixtures.js';

const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
const sources = slideFixture('sources');
sources.sources = [{ title: 'Project documentation', organization: 'SlideX' }];

const acceptedSources = {
  kind: 'slide', decision: 'accept', confidence: 'high',
  checks: {
    textReadability: 'pass', overlap: 'pass', clipping: 'pass', contrast: 'pass', hierarchy: 'pass',
    imageAlignment: 'not_applicable', sourcesReadability: 'pass', conclusionReadability: 'not_applicable',
  },
  issues: [], reason: 'The source list is readable without visible overlap.',
} as const;

test('slide report requires meaningful universal checks and no contradictory acceptance', () => {
  assert.equal(slideAiQualityReportSchema.safeParse(acceptedSources).success, true);
  assert.equal(slideAiQualityReportSchema.safeParse({ ...acceptedSources, checks: { ...acceptedSources.checks, overlap: 'fail' } }).success, false);
  assert.equal(slideAiQualityReportSchema.safeParse({ ...acceptedSources, checks: { ...acceptedSources.checks, contrast: 'not_applicable' } }).success, false);
  assert.equal(slideAiQualityReportSchema.safeParse({ ...acceptedSources, unexpected: true }).success, false);
});

test('Gemini slide evaluator sends PNG and canonical slide data with a structured schema', async () => {
  let requestBody: Record<string, unknown> | undefined;
  const fetchImpl: typeof fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(acceptedSources) }] } }] });
  };
  const evaluate = createGeminiSlideQualityEvaluator({ apiKey: 'test-key', model: 'gemini-test', fetchImpl });
  assert.deepEqual(await evaluate({ slide: sources, png }), acceptedSources);
  const serialized = JSON.stringify(requestBody);
  assert.ok(serialized.includes(Buffer.from(png).toString('base64')));
  assert.match(serialized, /Project documentation/);
  assert.match(serialized, /foreground shape that hides expected slide text is overlap/);
  const generationConfig = requestBody?.generationConfig as Record<string, unknown>;
  assert.equal(generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(generationConfig.responseSchema, slideAiQualityJsonSchema);
  assert.deepEqual(Object.keys(slideAiQualityJsonSchema.properties), slideAiQualityJsonSchema.required);
  assert.deepEqual(Object.keys(slideAiQualityJsonSchema.properties.checks.properties), slideAiQualityJsonSchema.properties.checks.required);
});

test('Gemini slide evaluator rejects role mismatch, bad PNG, and API failures', async () => {
  const mismatchFetch: typeof fetch = async () => Response.json({
    candidates: [{ content: { parts: [{ text: JSON.stringify({
      ...acceptedSources,
      checks: { ...acceptedSources.checks, sourcesReadability: 'not_applicable' },
    }) }] } }],
  });
  const evaluateMismatch = createGeminiSlideQualityEvaluator({ apiKey: 'test-key', model: 'gemini-test', fetchImpl: mismatchFetch });
  await assert.rejects(evaluateMismatch({ slide: sources, png }), /sourcesReadability/);
  await assert.rejects(evaluateMismatch({ slide: sources, png: new Uint8Array([1, 2, 3]) }), /valid PNG/);

  const failedFetch: typeof fetch = async () => new Response('upstream details', { status: 503 });
  const evaluateFailure = createGeminiSlideQualityEvaluator({ apiKey: 'test-key', model: 'gemini-test', fetchImpl: failedFetch });
  await assert.rejects(evaluateFailure({ slide: sources, png }), /HTTP 503/);
  assert.throws(() => createGeminiSlideQualityEvaluator({ apiKey: '', model: 'gemini-test' }), /GEMINI_API_KEY/);
});
