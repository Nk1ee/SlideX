import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

type WorkflowNode = {
  name: string;
  type: string;
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
};

type Workflow = {
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: Record<string, unknown>;
};

const workflowPath = resolve('integrations/n8n/workflow.education-context.json');
const fsmPath = resolve('integrations/n8n/fsm-engine.education-context.js');
const generatorPath = resolve('scripts/build-n8n-education-workflow.mjs');

async function loadWorkflow(path = workflowPath): Promise<Workflow> {
  return JSON.parse(await readFile(path, 'utf8')) as Workflow;
}

function requiredNode(workflow: Workflow, name: string): WorkflowNode {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `Missing workflow node: ${name}`);
  return node;
}

test('generated n8n workflow is inactive, reproducible and uses the reviewed FSM', async () => {
  const workflow = await loadWorkflow();
  assert.equal(workflow.active, false);
  assert.equal(workflow.name, 'SlideX — education context staging');
  assert.equal(requiredNode(workflow, 'FSM Engine').parameters.jsCode, (await readFile(fsmPath, 'utf8')).trimEnd());

  const directory = await mkdtemp(join(tmpdir(), 'slidex-n8n-'));
  const regeneratedPath = join(directory, 'workflow.json');
  try {
    execFileSync(process.execPath, [generatorPath, '--output', regeneratedPath], { stdio: 'pipe' });
    assert.equal(await readFile(regeneratedPath, 'utf8'), await readFile(workflowPath, 'utf8'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Supabase update node persists education fields and selected style', async () => {
  const workflow = await loadWorkflow();
  const updateNode = requiredNode(workflow, 'Update a row');
  const fieldsUi = updateNode.parameters.fieldsUi as { fieldValues: Array<{ fieldId: string; fieldValue: string }> };
  const fields = new Map(fieldsUi.fieldValues.map((field) => [field.fieldId, field.fieldValue]));
  for (const field of ['education_stage', 'school_class', 'course', 'presentation_style']) {
    assert.ok(fields.has(field), `Missing Supabase field: ${field}`);
  }
  assert.match(fields.get('state') ?? '', /Get a row.*state/);
});

test('theme preview is sent only when FSM requests it, then flow rejoins readiness gate', async () => {
  const workflow = await loadWorkflow();
  const photoNode = requiredNode(workflow, 'Send Theme Choice Photo');
  assert.equal(photoNode.parameters.operation, 'sendPhoto');
  assert.equal(photoNode.parameters.binaryData, false);
  assert.equal(photoNode.parameters.file, 'https://raw.githubusercontent.com/Nk1ee/SlideX/main/docs/themes/telegram-theme-choice.png');

  const serializedConnections = JSON.stringify(workflow.connections);
  assert.match(serializedConnections, /Check Reply Photo/);
  assert.match(serializedConnections, /Send Theme Choice Photo/);
  assert.match(serializedConnections, /Check If Ready/);
});

test('Gemini and Parse Structure receive trusted education metadata without changing topic', async () => {
  const workflow = await loadWorkflow();
  const geminiBody = String(requiredNode(workflow, 'Gemini-Structure').parameters.jsonBody);
  const parseCode = String(requiredNode(workflow, 'Parse Structure').parameters.jsCode);
  assert.match(geminiBody, /Учебный контекст/);
  assert.doesNotMatch(geminiBody, /элитную университетскую/);
  assert.match(parseCode, /educationContext: fsmRequest\.educationContext/);
  assert.match(parseCode, /fullTopic: fsmRequest\.topic/);
  assert.doesNotMatch(parseCode, /fullTopic:.*\.trim\(\)/);
  assert.doesNotMatch(parseCode, /fsmRequest\.style \|\|/);
});

test('import artifact contains placeholders instead of live credentials and stays inactive', async () => {
  const raw = await readFile(workflowPath, 'utf8');
  const workflow = JSON.parse(raw) as Workflow;
  assert.equal(workflow.active, false);
  assert.doesNotMatch(raw, /AIza[0-9A-Za-z_-]{20,}/);
  for (const node of workflow.nodes) {
    for (const credential of Object.values(node.credentials ?? {})) {
      assert.equal(credential.id, 'REDACTED');
    }
  }
});
