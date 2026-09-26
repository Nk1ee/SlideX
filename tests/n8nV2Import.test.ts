import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

type Credential = { id: string; name: string };
type ImportModule = {
  buildV2ApiPayload: (workflow: Record<string, unknown>, settings: {
    rendererUrl: string;
    telegramCredential: Credential;
    supabaseCredential: Credential;
    geminiCredential: Credential;
    rendererCredential: Credential;
  }) => Record<string, unknown> & { nodes: Array<Record<string, unknown>> };
  importV2Workflow: (options: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const moduleUrl = pathToFileURL(resolve('scripts/import-n8n-v2-staging.mjs')).href;

function credentials() {
  return {
    telegramCredential: { id: 'telegram-id', name: 'Telegram' },
    supabaseCredential: { id: 'supabase-id', name: 'Supabase' },
    geminiCredential: { id: 'gemini-id', name: 'SlideX V2 Gemini API' },
    rendererCredential: { id: 'renderer-id', name: 'SlideX V2 Renderer Bearer' },
  };
}

test('V2 n8n payload stays inactive and binds every credential explicitly', async () => {
  const module = await import(moduleUrl) as ImportModule;
  const workflow = JSON.parse(await readFile(resolve('integrations/n8n/workflow.renderer-v2.json'), 'utf8')) as Record<string, unknown>;
  const payload = module.buildV2ApiPayload(workflow, {
    rendererUrl: 'https://renderer.example/render',
    ...credentials(),
  });
  assert.ok(!('active' in payload));
  const nodes = payload.nodes as Array<{
    name: string;
    parameters: Record<string, unknown>;
    credentials?: Record<string, Credential>;
    webhookId?: string;
  }>;
  assert.ok(nodes.every((node) => node.webhookId === undefined));
  assert.equal(nodes.find((node) => node.name === 'Gemini Structure V2')?.credentials?.httpHeaderAuth?.id, 'gemini-id');
  assert.equal(nodes.find((node) => node.name === 'Generate PPTX V2')?.credentials?.httpHeaderAuth?.id, 'renderer-id');
  assert.equal(nodes.find((node) => node.name === 'Generate PPTX V2')?.parameters.url, 'https://renderer.example/render');
  assert.ok(nodes.filter((node) => node.credentials?.telegramApi).every((node) => node.credentials?.telegramApi?.id === 'telegram-id'));
  assert.ok(nodes.filter((node) => node.credentials?.supabaseApi).every((node) => node.credentials?.supabaseApi?.id === 'supabase-id'));
});

test('V2 n8n importer dry-run performs no network requests', async () => {
  const module = await import(moduleUrl) as ImportModule;
  const forbiddenFetch = async () => { throw new Error('network must not be called'); };
  const result = await module.importV2Workflow({ apply: false, fetchImplementation: forbiddenFetch });
  assert.equal(result.mode, 'dry-run');
  assert.equal(result.name, 'SlideX — renderer v2 staging');
  assert.equal(result.remainsInactive, true);
});

test('V2 n8n importer creates restricted credentials and an inactive workflow once', async () => {
  const module = await import(moduleUrl) as ImportModule;
  const credentialBodies: Array<Record<string, unknown>> = [];
  let workflowBody: Record<string, unknown> | undefined;
  const fetchImplementation = (async (input: string | URL | globalThis.Request, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/workflows?limit=100')) return Response.json({ data: [] });
    if (url.endsWith('/workflows/source-id')) {
      return Response.json({ nodes: [
        { credentials: { telegramApi: { id: 'telegram-id', name: 'Telegram' } } },
        { credentials: { supabaseApi: { id: 'supabase-id', name: 'Supabase' } } },
      ] });
    }
    if (url.endsWith('/credentials?limit=100')) return Response.json({ data: [] });
    if (url.endsWith('/credentials') && init?.method === 'POST') {
      const body = JSON.parse(String(init.body)) as Record<string, unknown>;
      credentialBodies.push(body);
      return Response.json({ id: `credential-${credentialBodies.length}`, name: body.name, type: body.type });
    }
    if (url.endsWith('/workflows') && init?.method === 'POST') {
      workflowBody = JSON.parse(String(init.body)) as Record<string, unknown>;
      return Response.json({ id: 'workflow-id', name: workflowBody.name, active: false });
    }
    throw new Error(`unexpected request: ${url}`);
  }) as typeof fetch;

  const result = await module.importV2Workflow({
    apply: true,
    fetchImplementation,
    baseUrlValue: 'https://n8n.example',
    apiKey: 'n8n-key',
    sourceWorkflowId: 'source-id',
    rendererUrlValue: 'https://renderer.example/render',
    rendererToken: 'renderer-token',
    geminiApiKey: 'gemini-key',
  });

  assert.equal(result.mode, 'applied');
  assert.equal(result.active, false);
  assert.equal(credentialBodies.length, 2);
  assert.deepEqual(credentialBodies.map((body) => body.name), ['SlideX V2 Gemini API', 'SlideX V2 Renderer Bearer']);
  const credentialData = credentialBodies.map((body) => body.data as Record<string, unknown>);
  assert.deepEqual(credentialData.map((data) => data.allowedHttpRequestDomains), ['domains', 'domains']);
  assert.deepEqual(credentialData.map((data) => data.allowedDomains), ['generativelanguage.googleapis.com', 'renderer.example']);
  assert.ok(workflowBody && !('active' in workflowBody));
});

test('V2 n8n importer does not mutate credentials when the staging workflow already exists', async () => {
  const module = await import(moduleUrl) as ImportModule;
  const requests: string[] = [];
  const fetchImplementation = (async (input: string | URL | globalThis.Request) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith('/workflows?limit=100')) {
      return Response.json({ data: [{ id: 'existing-id', name: 'SlideX — renderer v2 staging' }] });
    }
    if (url.endsWith('/workflows/existing-id')) {
      return Response.json({ id: 'existing-id', name: 'SlideX — renderer v2 staging', active: false, nodes: [] });
    }
    throw new Error(`unexpected request: ${url}`);
  }) as typeof fetch;
  const result = await module.importV2Workflow({
    apply: true,
    fetchImplementation,
    baseUrlValue: 'https://n8n.example',
    apiKey: 'n8n-key',
    sourceWorkflowId: 'source-id',
    rendererUrlValue: 'https://renderer.example/render',
    rendererToken: 'renderer-token',
    geminiApiKey: 'gemini-key',
  });
  assert.equal(result.mode, 'existing');
  assert.deepEqual(requests.map((url) => new URL(url).pathname), ['/api/v1/workflows', '/api/v1/workflows/existing-id']);
});
