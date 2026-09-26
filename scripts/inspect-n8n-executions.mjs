import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { normalizeApiBaseUrl, readLocalSetting } from './import-n8n-staging.mjs';

function readArgument(name) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument ? argument.slice(prefix.length).trim() : '';
}

function safeExecutionSummary(execution) {
  const resultData = execution?.data?.resultData;
  return {
    id: String(execution?.id ?? ''),
    status: String(execution?.status ?? 'unknown'),
    startedAt: execution?.startedAt ?? null,
    stoppedAt: execution?.stoppedAt ?? null,
    lastNode: resultData?.lastNodeExecuted ?? null,
    error: typeof resultData?.error?.message === 'string' ? resultData.error.message : null,
  };
}

export async function inspectExecutions({
  fetchImplementation = fetch,
  baseUrlValue: suppliedBaseUrl,
  apiKey: suppliedApiKey,
  workflowId: suppliedWorkflowId,
  limit = 10,
} = {}) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Execution limit must be an integer from 1 to 100');
  }

  const [baseUrlValue, apiKey, workflowId] = await Promise.all([
    suppliedBaseUrl ?? readLocalSetting('N8N_BASE_URL'),
    suppliedApiKey ?? readLocalSetting('N8N_API_KEY'),
    suppliedWorkflowId ?? readLocalSetting('N8N_WORKFLOW_ID'),
  ]);
  if (!baseUrlValue || !apiKey || !workflowId) {
    throw new Error('Set N8N_BASE_URL, N8N_API_KEY and N8N_WORKFLOW_ID in environment variables or ignored .env.local/*.txt files');
  }

  const baseUrl = normalizeApiBaseUrl(baseUrlValue);
  const query = new URLSearchParams({
    workflowId,
    limit: String(limit),
    includeData: 'true',
  });
  const response = await fetchImplementation(`${baseUrl}/executions?${query}`, {
    headers: { Accept: 'application/json', 'X-N8N-API-KEY': apiKey },
  });
  if (!response.ok) throw new Error(`n8n execution list failed with HTTP ${response.status}`);
  const payload = await response.json();
  const executions = Array.isArray(payload.data) ? payload.data : [];
  return executions.map(safeExecutionSummary);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const workflowId = readArgument('workflow-id') || undefined;
  const limitValue = readArgument('limit');
  const limit = limitValue ? Number(limitValue) : 10;
  const result = await inspectExecutions({ workflowId, limit });
  console.log(JSON.stringify(result, null, 2));
}
