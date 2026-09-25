import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

type ImportModule = {
  buildApiPayload: (workflow: Record<string, unknown>) => Record<string, unknown> & { nodes: Array<Record<string, unknown>> };
  applyDeploymentSettings: (payload: Record<string, unknown>, rendererUrl: string) => Record<string, unknown> & { nodes: Array<Record<string, unknown>> };
  compareWorkflowDefinitions: (expected: Record<string, unknown>, actual: Record<string, unknown>) => boolean;
  normalizeApiBaseUrl: (value: string) => string;
  normalizeRendererUrl: (value: string) => string;
  importWorkflow: (options: {
    apply: boolean;
    fetchImplementation?: typeof fetch;
    baseUrlValue?: string;
    apiKey?: string;
    rendererUrlValue?: string;
  }) => Promise<Record<string, unknown>>;
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
  assert.throws(() => module.normalizeApiBaseUrl('https://https://example.test'), /repeated/);
  assert.throws(() => module.normalizeApiBaseUrl('https://example.test/workflow/123'), /instance URL/);
  assert.equal(module.normalizeRendererUrl('https://renderer.example/render'), 'https://renderer.example/render');
  assert.throws(() => module.normalizeRendererUrl('https://example.invalid/slidex-renderer'), /placeholder/);
  assert.throws(() => module.normalizeRendererUrl('http://renderer.example/render'), /HTTPS/);
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

test('n8n importer inspects a duplicate without creating or updating it', async () => {
  const module = await import(modulePath.href) as ImportModule;
  const workflow = JSON.parse(await readFile(resolve('integrations/n8n/workflow.education-context.json'), 'utf8')) as Record<string, unknown>;
  const existingWorkflow = structuredClone(workflow) as Record<string, unknown> & {
    id?: string;
    active?: boolean;
    nodes: Array<Record<string, unknown>>;
  };
  existingWorkflow.id = 'existing-id';
  existingWorkflow.active = true;
  existingWorkflow.nodes[0]!.credentials = { telegramApi: { id: 'private-id', name: 'test' } };
  existingWorkflow.nodes[0]!.webhookId = 'private-webhook-id';
  const rendererNode = existingWorkflow.nodes.find((node) => node.name === 'Generate PPTX File') as {
    parameters: Record<string, unknown>;
  };
  rendererNode.parameters.url = 'https://renderer.example/render';
  const requests: Array<{ url: string; method: string }> = [];
  const mockFetch = (async (input: string | URL | globalThis.Request, init?: RequestInit) => {
    const url = String(input);
    requests.push({ url, method: init?.method ?? 'GET' });
    if (url.endsWith('/workflows?limit=100')) {
      return Response.json({ data: [{ id: 'existing-id', name: workflow.name }] });
    }
    if (url.endsWith('/workflows/existing-id')) return Response.json(existingWorkflow);
    throw new Error(`unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await module.importWorkflow({
    apply: true,
    fetchImplementation: mockFetch,
    baseUrlValue: 'https://n8n.example',
    apiKey: 'test-key',
    rendererUrlValue: 'https://renderer.example/render',
  });

  assert.deepEqual(result, {
    mode: 'existing',
    id: 'existing-id',
    name: workflow.name,
    active: true,
    nodeCount: 18,
    definitionMatches: true,
    created: false,
  });
  assert.deepEqual(requests.map((request) => request.method), ['GET', 'GET']);
});

test('n8n importer injects renderer URL only into an inactive create payload', async () => {
  const module = await import(modulePath.href) as ImportModule;
  let createPayload: Record<string, unknown> | undefined;
  const mockFetch = (async (input: string | URL | globalThis.Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/workflows?limit=100')) return Response.json({ data: [] });
    if (url.endsWith('/workflows') && init?.method === 'POST') {
      createPayload = JSON.parse(String(init.body)) as Record<string, unknown>;
      return Response.json({ id: 'created-id', name: createPayload.name, active: false });
    }
    throw new Error(`unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await module.importWorkflow({
    apply: true,
    fetchImplementation: mockFetch,
    baseUrlValue: 'https://n8n.example',
    apiKey: 'test-key',
    rendererUrlValue: 'https://renderer.example/render',
  });

  assert.deepEqual(result, {
    mode: 'applied',
    id: 'created-id',
    name: 'SlideX — education context staging',
    active: false,
  });
  assert.ok(createPayload);
  assert.ok(!('active' in createPayload));
  const nodes = createPayload.nodes as Array<{ name: string; parameters: Record<string, unknown>; credentials?: unknown }>;
  assert.equal(nodes.find((node) => node.name === 'Generate PPTX File')?.parameters.url, 'https://renderer.example/render');
  assert.ok(nodes.every((node) => !('credentials' in node)));
});
