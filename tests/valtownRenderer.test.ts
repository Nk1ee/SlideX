import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createValTownRendererHandler } from '../src/integrations/valtownRenderer.js';
import { validatePptxBinary } from '../src/qc/pptxValidation.js';
import { presentationFixture, requests } from './regression/fixtures.js';

function environment(values: Readonly<Record<string, string>>): (name: string) => string | undefined {
  return (name) => values[name];
}

function post(body: unknown, token = 'test-render-token'): Request {
  return new Request('https://example.test/render', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

test('Val Town health check reports capabilities without exposing secrets', async () => {
  const handler = createValTownRendererHandler({
    readEnvironment: environment({
      SLIDEX_RENDER_TOKEN: 'secret-value',
      UNSPLASH_ACCESS_KEY: 'unsplash-secret',
      GEMINI_API_KEY: 'gemini-secret',
      GEMINI_QC_MODEL: 'gemini-model',
    }),
  });
  const response = await handler(new Request('https://example.test/render'));
  assert.equal(response.status, 200);
  const body = await response.json() as {
    configuration: Record<string, boolean>;
    layouts: string[];
  };
  assert.equal(body.configuration.renderTokenConfigured, true);
  assert.equal(body.configuration.unsplashConfigured, true);
  assert.equal(body.configuration.geminiImageQcConfigured, true);
  assert.ok(body.layouts.includes('chart'));
  assert.equal(JSON.stringify(body).includes('secret-value'), false);
  assert.equal(JSON.stringify(body).includes('gemini-secret'), false);
});

test('Val Town renderer rejects requests without the shared bearer token', async () => {
  const handler = createValTownRendererHandler({
    readEnvironment: environment({ SLIDEX_RENDER_TOKEN: 'test-render-token' }),
  });
  const response = await handler(post({}, 'wrong-token'));
  assert.equal(response.status, 401);
  assert.equal((await response.json() as { error: { code: string } }).error.code, 'UNAUTHORIZED');
});

test('Val Town renderer validates trusted FSM metadata before rendering', async () => {
  const request = requests[0]!;
  const payload = presentationFixture(request);
  payload.presentation.subject = 'Изменённый предмет';
  const handler = createValTownRendererHandler({
    readEnvironment: environment({ SLIDEX_RENDER_TOKEN: 'test-render-token' }),
  });
  const response = await handler(post({ request, payload }));
  assert.equal(response.status, 422);
  const body = await response.json() as { error: { code: string; message: string } };
  assert.equal(body.error.code, 'QUALITY_GATE_REJECTED');
  assert.match(body.error.message, /Metadata mismatch: subject/);
});

test('Val Town renderer returns a structurally valid PPTX with exact slide count', async () => {
  const request = requests[0]!;
  const payload = presentationFixture(request);
  const handler = createValTownRendererHandler({
    readEnvironment: environment({ SLIDEX_RENDER_TOKEN: 'test-render-token' }),
  });
  const response = await handler(post({ request, payload }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  assert.equal(response.headers.get('x-slidex-slide-count'), String(request.slideCount));
  const binary = new Uint8Array(await response.arrayBuffer());
  const report = await validatePptxBinary(binary, { expectedSlideCount: request.slideCount });
  assert.equal(report.ok, true, report.issues.join('; '));
  assert.equal(report.slideCount, request.slideCount);
});
