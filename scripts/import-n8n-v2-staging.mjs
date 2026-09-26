import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import {
  normalizeApiBaseUrl,
  normalizeRendererUrl,
  readLocalSetting,
} from './import-n8n-staging.mjs';

const WORKFLOW_PATH = resolve('integrations/n8n/workflow.renderer-v2.json');
const WORKFLOW_NAME = 'SlideX — renderer v2 staging';
const GEMINI_CREDENTIAL_NAME = 'SlideX V2 Gemini API';
const RENDERER_CREDENTIAL_NAME = 'SlideX V2 Renderer Bearer';

function credentialReference(id, name) {
  return { id: String(id), name };
}

function singleCredentialFromWorkflow(workflow, type) {
  const matches = new Map();
  for (const node of workflow.nodes ?? []) {
    const credential = node.credentials?.[type];
    if (credential?.id) matches.set(String(credential.id), credentialReference(credential.id, credential.name));
  }
  if (matches.size !== 1) {
    throw new Error(`Expected exactly one ${type} credential in the source workflow, found ${matches.size}`);
  }
  return [...matches.values()][0];
}

export function buildV2ApiPayload(workflow, { rendererUrl, telegramCredential, supabaseCredential, geminiCredential, rendererCredential }) {
  if (workflow.active !== false) throw new Error('Refusing to import a workflow that is not explicitly inactive');
  const payload = structuredClone(workflow);
  delete payload.active;
  delete payload.id;
  payload.name = WORKFLOW_NAME;

  for (const node of payload.nodes ?? []) {
    delete node.webhookId;
    if (node.name === 'Generate PPTX V2') {
      node.parameters.url = normalizeRendererUrl(rendererUrl);
      node.credentials = { httpHeaderAuth: rendererCredential };
      continue;
    }
    if (node.name === 'Gemini Structure V2') {
      node.credentials = { httpHeaderAuth: geminiCredential };
      continue;
    }
    if (node.credentials?.telegramApi) {
      node.credentials = { ...node.credentials, telegramApi: telegramCredential };
    }
    if (node.credentials?.supabaseApi) {
      node.credentials = { ...node.credentials, supabaseApi: supabaseCredential };
    }
  }

  return {
    name: payload.name,
    nodes: payload.nodes,
    connections: payload.connections,
    settings: payload.settings ?? {},
  };
}

function apiHeaders(apiKey, json = false) {
  return {
    Accept: 'application/json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'X-N8N-API-KEY': apiKey,
  };
}

async function fetchJson(fetchImplementation, url, init, operation) {
  const response = await fetchImplementation(url, init);
  if (!response.ok) throw new Error(`${operation} failed with HTTP ${response.status}`);
  return response.json();
}

async function findOrCreateHeaderCredential({ fetchImplementation, baseUrl, apiKey, credentials, name, headerName, headerValue, allowedDomain }) {
  const matches = credentials.filter((item) => item.name === name);
  if (matches.length > 1) throw new Error(`More than one n8n credential is named ${name}`);
  if (matches.length === 1) {
    if (matches[0].type !== 'httpHeaderAuth') throw new Error(`${name} exists with an unexpected credential type`);
    return { reference: credentialReference(matches[0].id, name), created: false };
  }

  const created = await fetchJson(fetchImplementation, `${baseUrl}/credentials`, {
    method: 'POST',
    headers: apiHeaders(apiKey, true),
    body: JSON.stringify({
      name,
      type: 'httpHeaderAuth',
      data: {
        name: headerName,
        value: headerValue,
        allowedHttpRequestDomains: 'domains',
        allowedDomains: allowedDomain,
      },
    }),
  }, `n8n credential creation for ${name}`);

  return { reference: credentialReference(created.id, name), created: true };
}

export async function importV2Workflow({
  apply = false,
  fetchImplementation = fetch,
  baseUrlValue: suppliedBaseUrl,
  apiKey: suppliedApiKey,
  sourceWorkflowId: suppliedSourceWorkflowId,
  rendererUrlValue: suppliedRendererUrl,
  rendererToken: suppliedRendererToken,
  geminiApiKey: suppliedGeminiApiKey,
} = {}) {
  const workflow = JSON.parse(await readFile(WORKFLOW_PATH, 'utf8'));
  if (workflow.active !== false) throw new Error('Refusing to import a workflow that is not explicitly inactive');

  if (!apply) {
    return {
      mode: 'dry-run',
      name: WORKFLOW_NAME,
      nodeCount: workflow.nodes.length,
      createsCredentialsOnlyWhenMissing: true,
      remainsInactive: true,
    };
  }

  const [baseUrlValue, apiKey, sourceWorkflowId, rendererUrlValue, rendererToken, geminiApiKey] = await Promise.all([
    suppliedBaseUrl ?? readLocalSetting('N8N_BASE_URL'),
    suppliedApiKey ?? readLocalSetting('N8N_API_KEY'),
    suppliedSourceWorkflowId ?? readLocalSetting('N8N_WORKFLOW_ID'),
    suppliedRendererUrl ?? readLocalSetting('SLIDEX_RENDERER_V2_URL'),
    suppliedRendererToken ?? readLocalSetting('SLIDEX_RENDER_TOKEN'),
    suppliedGeminiApiKey ?? readLocalSetting('GEMINI_API_KEY'),
  ]);
  if (!baseUrlValue || !apiKey || !sourceWorkflowId || !rendererUrlValue || !rendererToken || !geminiApiKey) {
    throw new Error('Missing one or more required local settings: N8N_BASE_URL, N8N_API_KEY, N8N_WORKFLOW_ID, SLIDEX_RENDERER_V2_URL, SLIDEX_RENDER_TOKEN, GEMINI_API_KEY');
  }

  const baseUrl = normalizeApiBaseUrl(baseUrlValue);
  const rendererUrl = normalizeRendererUrl(rendererUrlValue);
  const workflowList = await fetchJson(fetchImplementation, `${baseUrl}/workflows?limit=100`, {
    headers: apiHeaders(apiKey),
  }, 'n8n workflow list');
  const existing = Array.isArray(workflowList.data)
    ? workflowList.data.filter((item) => item.name === WORKFLOW_NAME)
    : [];
  if (existing.length > 1) throw new Error(`More than one n8n workflow is named ${WORKFLOW_NAME}`);
  if (existing.length === 1) {
    const existingWorkflow = await fetchJson(fetchImplementation, `${baseUrl}/workflows/${encodeURIComponent(existing[0].id)}`, {
      headers: apiHeaders(apiKey),
    }, 'n8n existing V2 workflow read');
    return {
      mode: 'existing',
      id: existingWorkflow.id,
      name: existingWorkflow.name,
      active: existingWorkflow.active === true,
      nodeCount: Array.isArray(existingWorkflow.nodes) ? existingWorkflow.nodes.length : 0,
      created: false,
    };
  }

  const [sourceWorkflow, credentialList] = await Promise.all([
    fetchJson(fetchImplementation, `${baseUrl}/workflows/${encodeURIComponent(sourceWorkflowId)}`, {
      headers: apiHeaders(apiKey),
    }, 'n8n source workflow read'),
    fetchJson(fetchImplementation, `${baseUrl}/credentials?limit=100`, {
      headers: apiHeaders(apiKey),
    }, 'n8n credential list'),
  ]);
  const credentials = Array.isArray(credentialList.data) ? credentialList.data : [];
  const telegramCredential = singleCredentialFromWorkflow(sourceWorkflow, 'telegramApi');
  const supabaseCredential = singleCredentialFromWorkflow(sourceWorkflow, 'supabaseApi');
  const rendererHost = new URL(rendererUrl).hostname;

  const geminiResult = await findOrCreateHeaderCredential({
    fetchImplementation,
    baseUrl,
    apiKey,
    credentials,
    name: GEMINI_CREDENTIAL_NAME,
    headerName: 'x-goog-api-key',
    headerValue: geminiApiKey,
    allowedDomain: 'generativelanguage.googleapis.com',
  });
  if (geminiResult.created) credentials.push({ id: geminiResult.reference.id, name: GEMINI_CREDENTIAL_NAME, type: 'httpHeaderAuth' });
  const rendererResult = await findOrCreateHeaderCredential({
    fetchImplementation,
    baseUrl,
    apiKey,
    credentials,
    name: RENDERER_CREDENTIAL_NAME,
    headerName: 'Authorization',
    headerValue: `Bearer ${rendererToken}`,
    allowedDomain: rendererHost,
  });

  const payload = buildV2ApiPayload(workflow, {
    rendererUrl,
    telegramCredential,
    supabaseCredential,
    geminiCredential: geminiResult.reference,
    rendererCredential: rendererResult.reference,
  });
  const created = await fetchJson(fetchImplementation, `${baseUrl}/workflows`, {
    method: 'POST',
    headers: apiHeaders(apiKey, true),
    body: JSON.stringify(payload),
  }, 'n8n V2 workflow creation');

  return {
    mode: 'applied',
    id: created.id,
    name: created.name,
    active: created.active === true,
    nodeCount: payload.nodes.length,
    credentialsCreated: {
      gemini: geminiResult.created,
      renderer: rendererResult.created,
    },
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const result = await importV2Workflow({ apply: process.argv.includes('--apply') });
  console.log(JSON.stringify(result, null, 2));
}
