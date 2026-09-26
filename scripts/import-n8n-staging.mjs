import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const WORKFLOW_PATH = resolve('integrations/n8n/workflow.education-context.json');

export function buildApiPayload(workflow) {
  const payload = structuredClone(workflow);
  for (const node of payload.nodes ?? []) {
    delete node.credentials;
    delete node.webhookId;
  }
  return {
    name: payload.name,
    nodes: payload.nodes,
    connections: payload.connections,
    settings: payload.settings ?? {},
  };
}

export function normalizeApiBaseUrl(value) {
  if (/^https?:\/\/https?:\/\//i.test(value)) {
    throw new Error('N8N_BASE_URL contains a repeated http:// or https:// prefix');
  }
  const url = new URL(value);
  if (['http', 'https'].includes(url.hostname.toLowerCase())) {
    throw new Error('N8N_BASE_URL hostname is invalid; use the n8n instance base URL');
  }
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('N8N_BASE_URL must use HTTPS unless n8n runs on localhost');
  }
  const cleanPath = url.pathname.replace(/\/+$/, '');
  if (/\/workflow(?:\/|$)/i.test(cleanPath)) {
    throw new Error('N8N_BASE_URL must be the instance URL, not a link to one workflow');
  }
  url.pathname = cleanPath.endsWith('/api/v1') ? cleanPath : `${cleanPath}/api/v1`;
  return url.toString().replace(/\/$/, '');
}

export function normalizeRendererUrl(value) {
  const url = new URL(value);
  if (url.hostname === 'example.invalid') throw new Error('SLIDEX_RENDERER_URL still points to the disabled placeholder');
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error('SLIDEX_RENDERER_URL must use HTTPS unless the renderer runs on localhost');
  }
  return url.toString();
}

export function applyDeploymentSettings(payload, rendererUrlValue) {
  const configured = structuredClone(payload);
  const rendererNodes = configured.nodes.filter((node) => node.name === 'Generate PPTX File');
  if (rendererNodes.length !== 1) throw new Error('Expected exactly one Generate PPTX File node');
  rendererNodes[0].parameters.url = normalizeRendererUrl(rendererUrlValue);
  return configured;
}

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableSerialize(item)}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function compareWorkflowDefinitions(expectedWorkflow, actualWorkflow) {
  const expected = buildApiPayload(expectedWorkflow);
  const actual = buildApiPayload(actualWorkflow);
  const expectedSettingKeys = Object.keys(expected.settings);
  actual.settings = Object.fromEntries(expectedSettingKeys.map((key) => [key, actual.settings[key]]));
  return stableSerialize(expected) === stableSerialize(actual);
}

export function parseLocalSettingText(name, text) {
  const value = text.trim();
  const prefix = `${name}=`;
  return value.startsWith(prefix) ? value.slice(prefix.length).trim() : value;
}

export async function readLocalSetting(name) {
  if (process.env[name]?.trim()) return process.env[name].trim();
  try {
    const text = await readFile(resolve('.env.local', `${name}.txt`), 'utf8');
    return parseLocalSettingText(name, text);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return '';
    throw error;
  }
}

export async function importWorkflow({
  apply = false,
  fetchImplementation = fetch,
  baseUrlValue: suppliedBaseUrl,
  apiKey: suppliedApiKey,
  rendererUrlValue: suppliedRendererUrl,
} = {}) {
  const workflow = JSON.parse(await readFile(WORKFLOW_PATH, 'utf8'));
  if (workflow.active !== false) throw new Error('Refusing to import a workflow that is not explicitly inactive');
  const payload = buildApiPayload(workflow);

  if (!apply) {
    return { mode: 'dry-run', name: payload.name, nodeCount: payload.nodes.length, credentialIdsRemoved: true };
  }

  const [baseUrlValue, apiKey, rendererUrlValue] = await Promise.all([
    suppliedBaseUrl ?? readLocalSetting('N8N_BASE_URL'),
    suppliedApiKey ?? readLocalSetting('N8N_API_KEY'),
    suppliedRendererUrl ?? readLocalSetting('SLIDEX_RENDERER_URL'),
  ]);
  if (!baseUrlValue || !apiKey || !rendererUrlValue) {
    throw new Error('Set N8N_BASE_URL, N8N_API_KEY and SLIDEX_RENDERER_URL in the environment or ignored .env.local/*.txt files');
  }
  const baseUrl = normalizeApiBaseUrl(baseUrlValue);
  const configuredPayload = applyDeploymentSettings(payload, rendererUrlValue);

  const listResponse = await fetchImplementation(`${baseUrl}/workflows?limit=100`, {
    headers: { Accept: 'application/json', 'X-N8N-API-KEY': apiKey },
  });
  if (!listResponse.ok) throw new Error(`n8n workflow list failed with HTTP ${listResponse.status}`);
  const list = await listResponse.json();
  const existing = Array.isArray(list.data) ? list.data.find((item) => item.name === payload.name) : undefined;
  if (existing) {
    const existingResponse = await fetchImplementation(`${baseUrl}/workflows/${encodeURIComponent(existing.id)}`, {
      headers: { Accept: 'application/json', 'X-N8N-API-KEY': apiKey },
    });
    if (!existingResponse.ok) throw new Error(`n8n existing workflow read failed with HTTP ${existingResponse.status}`);
    const existingWorkflow = await existingResponse.json();
    return {
      mode: 'existing',
      id: existingWorkflow.id,
      name: existingWorkflow.name,
      active: existingWorkflow.active === true,
      nodeCount: Array.isArray(existingWorkflow.nodes) ? existingWorkflow.nodes.length : 0,
      definitionMatches: compareWorkflowDefinitions(configuredPayload, existingWorkflow),
      created: false,
    };
  }

  const createResponse = await fetchImplementation(`${baseUrl}/workflows`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': apiKey,
    },
    body: JSON.stringify(configuredPayload),
  });
  if (!createResponse.ok) throw new Error(`n8n workflow creation failed with HTTP ${createResponse.status}`);
  const created = await createResponse.json();
  return { mode: 'applied', id: created.id, name: created.name, active: created.active === true };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const result = await importWorkflow({ apply: process.argv.includes('--apply') });
  console.log(JSON.stringify(result, null, 2));
}
