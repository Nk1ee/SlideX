import assert from 'node:assert/strict';
import test from 'node:test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type InspectorModule = {
  inspectExecutions: (options: {
    fetchImplementation: typeof fetch;
    baseUrlValue: string;
    apiKey: string;
    workflowId: string;
    limit?: number;
  }) => Promise<Array<Record<string, unknown>>>;
};

const modulePath = pathToFileURL(resolve('scripts/inspect-n8n-executions.mjs'));

test('n8n execution inspector returns diagnostics without workflow input data', async () => {
  const module = await import(modulePath.href) as InspectorModule;
  let requestedUrl = '';
  const mockFetch = (async (input: string | URL | globalThis.Request) => {
    requestedUrl = String(input);
    return Response.json({
      data: [{
        id: '553',
        status: 'error',
        startedAt: '2026-09-25T22:03:02.508Z',
        stoppedAt: '2026-09-25T22:03:12.291Z',
        data: {
          resultData: {
            lastNodeExecuted: 'Generate PPTX File1',
            error: { message: 'The connection cannot be established' },
            runData: { privatePayload: { studentName: 'Do not expose', topic: 'Private topic' } },
          },
        },
      }],
    });
  }) as typeof fetch;

  const result = await module.inspectExecutions({
    fetchImplementation: mockFetch,
    baseUrlValue: 'https://n8n.example',
    apiKey: 'secret-key',
    workflowId: 'workflow-id',
    limit: 8,
  });

  assert.equal(
    requestedUrl,
    'https://n8n.example/api/v1/executions?workflowId=workflow-id&limit=8&includeData=true',
  );
  assert.deepEqual(result, [{
    id: '553',
    status: 'error',
    startedAt: '2026-09-25T22:03:02.508Z',
    stoppedAt: '2026-09-25T22:03:12.291Z',
    lastNode: 'Generate PPTX File1',
    error: 'The connection cannot be established',
  }]);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('studentName'));
  assert.ok(!serialized.includes('Private topic'));
  assert.ok(!serialized.includes('secret-key'));
});

test('n8n execution inspector rejects unsafe result limits', async () => {
  const module = await import(modulePath.href) as InspectorModule;
  const forbiddenFetch = (async () => {
    throw new Error('network must not be called');
  }) as typeof fetch;

  await assert.rejects(
    module.inspectExecutions({
      fetchImplementation: forbiddenFetch,
      baseUrlValue: 'https://n8n.example',
      apiKey: 'test-key',
      workflowId: 'workflow-id',
      limit: 101,
    }),
    /integer from 1 to 100/,
  );
});
