import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

type ImportModule = {
  buildApiPayload: (workflow: Record<string, unknown>) => Record<string, unknown> & { nodes: Array<Record<string, unknown>> };
  normalizeApiBaseUrl: (value: string) => string;
  importWorkflow: (options: { apply: boolean; fetchImplementation?: typeof fetch }) => Promise<Record<string, unknown>>;
};

const modulePath = pathToFileURL(resolve('scripts/import-n8n-staging.mjs'));

test('n8n API payload removes credentials and activation state', async () => {
  const module = await import(modulePath.href) as ImportModule;
  const workflow = JSON.parse(await readFile(resolve('integrations/n8n/workflow.education-context.json'), 'utf8')) as Record<string, unknown>;
  const payload = module.buildApiPayload(workflow);
  assert.deepEqual(Object.keys(payload).sort(), ['connections', 'name', 'nodes', 'settings']);
  assert.ok(payload.nodes.every((node) => !('credentials' in node) && !('webhookId' in node)));
  assert.ok(!('active' in payload));
});

test('n8n API URL normalization accepts HTTPS and local development only', async () => {
  const module = await import(modulePath.href) as ImportModule;
  assert.equal(module.normalizeApiBaseUrl('https://example.app.n8n.cloud'), 'https://example.app.n8n.cloud/api/v1');
  assert.equal(module.normalizeApiBaseUrl('https://example.test/api/v1/'), 'https://example.test/api/v1');
  assert.equal(module.normalizeApiBaseUrl('http://localhost:5678'), 'http://localhost:5678/api/v1');
  assert.throws(() => module.normalizeApiBaseUrl('http://example.test'), /HTTPS/);
});

test('n8n importer defaults to a network-free dry run', async () => {
  const module = await import(modulePath.href) as ImportModule;
  const forbiddenFetch = (async () => {
    throw new Error('network must not be called during dry-run');
  }) as typeof fetch;
  const result = await module.importWorkflow({ apply: false, fetchImplementation: forbiddenFetch });
  assert.deepEqual(result, {
    mode: 'dry-run',
    name: 'SlideX — education context staging',
    nodeCount: 18,
    credentialIdsRemoved: true,
  });
});
