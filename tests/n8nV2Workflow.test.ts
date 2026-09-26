import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { layoutSchema } from '../src/presentation/schema.js';
import { presentationFixture, requests } from './regression/fixtures.js';

type WorkflowNode = {
  name: string;
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
};

type Workflow = {
  name: string;
  active: boolean;
  nodes: WorkflowNode[];
  connections: Record<string, unknown>;
};

const workflowPath = resolve('integrations/n8n/workflow.renderer-v2.json');
const parserPath = resolve('integrations/n8n/parse-structure-v2.js');
const promptPath = resolve('integrations/n8n/gemini-prompt-v2.txt');
const schemaPath = resolve('integrations/n8n/gemini-response-schema-v2.json');
const generatorPath = resolve('scripts/build-n8n-v2-workflow.mjs');

function requiredNode(workflow: Workflow, name: string): WorkflowNode {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, 'Missing workflow node: ' + name);
  return node;
}

async function runParser(options: {
  requestIndex?: number;
  generated?: unknown;
  rawText?: string;
  chatId?: string | number;
} = {}): Promise<{ request: Record<string, unknown>; payload: Record<string, unknown> }> {
  const request = requests[options.requestIndex ?? 1]!;
  const fixture = presentationFixture(request);
  const generated = options.generated ?? {
    presentation: { displayTitle: fixture.presentation.displayTitle },
    slides: fixture.slides,
  };
  const rawText = options.rawText ?? JSON.stringify(generated);
  const geminiResponse = {
    candidates: [{
      finishReason: 'STOP',
      content: { parts: [{ text: rawText }] },
    }],
  };
  const fsmNode = {
    chatId: options.chatId ?? 123456,
    presentationRequest: request,
  };
  const parserCode = await readFile(parserPath, 'utf8');
  const execute = Function('$input', '$', parserCode) as (
    input: { first(): { json: unknown } },
    select: (name: string) => { first(): { json: unknown } },
  ) => Array<{ json: { request: Record<string, unknown>; payload: Record<string, unknown> } }>;
  const result = execute(
    { first: () => ({ json: geminiResponse }) },
    (name) => {
      assert.equal(name, 'FSM Engine');
      return { first: () => ({ json: fsmNode }) };
    },
  );
  return result[0]!.json;
}

test('Parse Structure V2 preserves Gemini fields and trusted FSM metadata exactly', async () => {
  const request = requests[1]!;
  const fixture = presentationFixture(request);
  fixture.slides[1]!.visual = {
    needed: true,
    type: 'diagram',
    concept: 'artificial neural network',
    query_en: 'artificial neural network',
    placement: 'left',
  };
  fixture.slides[1]!.layout = 'image_text';
  const result = await runParser({
    generated: {
      presentation: { displayTitle: 'ИИ в образовании' },
      slides: fixture.slides,
    },
  });

  assert.deepEqual(result.request, request);
  const payload = result.payload as {
    chatId: string;
    presentation: Record<string, unknown>;
    slides: unknown[];
  };
  assert.equal(payload.chatId, '123456');
  assert.equal(payload.presentation.fullTopic, request.topic);
  assert.equal(payload.presentation.subject, 'Информатик');
  assert.equal(payload.presentation.studentName, 'Ох');
  assert.equal(payload.presentation.group, '4');
  assert.equal(payload.presentation.slideCount, 13);
  assert.equal(payload.presentation.displayTitle, 'ИИ в образовании');
  assert.deepEqual(payload.slides, fixture.slides);
});

test('Parse Structure V2 rejects malformed JSON and count mismatch without repair', async () => {
  await assert.rejects(() => runParser({ rawText: '{ invalid json' }), /не является JSON/);
  const fixture = presentationFixture(requests[0]!);
  await assert.rejects(() => runParser({
    requestIndex: 0,
    generated: {
      presentation: { displayTitle: 'Тест' },
      slides: fixture.slides.slice(0, -1),
    },
  }), /9 слайдов вместо 10/);
});

test('Gemini V2 schema uses exactly the canonical layout and field names', async () => {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8')) as {
    properties: {
      slides: {
        items: {
          properties: Record<string, { properties?: Record<string, unknown>; type?: string; items?: { properties?: Record<string, unknown> } }>;
          required: string[];
        };
      };
    };
  };
  const slide = schema.properties.slides.items;
  const layout = slide.properties.layout as unknown as { enum: string[] };
  assert.deepEqual(layout.enum, [...layoutSchema.options]);

  const card = slide.properties.cards!.items!.properties!;
  assert.ok('text' in card);
  assert.ok(!('description' in card));

  const comparison = slide.properties.comparison!.properties!;
  assert.ok('left' in comparison && 'right' in comparison);
  assert.ok(!('leftItems' in comparison));

  assert.equal(slide.properties.statistics!.type, 'ARRAY');
  assert.ok('columns' in slide.properties);
  assert.ok('steps' in slide.properties);
  assert.ok('chart' in slide.properties);
  assert.ok(slide.required.includes('visual'));
  assert.ok(slide.required.includes('sources'));
});

test('renderer V2 workflow is inactive, reproducible and sends the trusted envelope', async () => {
  const workflow = JSON.parse(await readFile(workflowPath, 'utf8')) as Workflow;
  assert.equal(workflow.active, false);
  assert.equal(workflow.name, 'SlideX — renderer v2 staging');

  const parseNode = requiredNode(workflow, 'Parse Structure V2');
  assert.equal(parseNode.parameters.jsCode, (await readFile(parserPath, 'utf8')).trimEnd());

  const renderer = requiredNode(workflow, 'Generate PPTX V2');
  assert.equal(renderer.parameters.url, 'https://example.invalid/slidex-renderer-v2');
  assert.equal(renderer.parameters.jsonBody, "={{ $('Parse Structure V2').first().json }}");
  assert.equal(renderer.parameters.authentication, 'genericCredentialType');
  assert.equal(renderer.parameters.genericAuthType, 'httpHeaderAuth');
  assert.equal(renderer.credentials?.httpHeaderAuth?.id, 'REDACTED');
  assert.equal(renderer.retryOnFail, true);
  assert.equal(renderer.maxTries, 3);
  assert.equal(renderer.waitBetweenTries, 5000);

  const serializedConnections = JSON.stringify(workflow.connections);
  assert.match(serializedConnections, /Gemini Structure V2/);
  assert.match(serializedConnections, /Parse Structure V2/);
  assert.match(serializedConnections, /Generate PPTX V2/);

  const directory = await mkdtemp(join(tmpdir(), 'slidex-n8n-v2-'));
  const regeneratedPath = join(directory, 'workflow.json');
  try {
    execFileSync(process.execPath, [generatorPath, '--output', regeneratedPath], { stdio: 'pipe' });
    assert.equal(await readFile(regeneratedPath, 'utf8'), await readFile(workflowPath, 'utf8'));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Gemini V2 request safely serializes metadata and embeds the reviewed schema', async () => {
  const workflow = JSON.parse(await readFile(workflowPath, 'utf8')) as Workflow;
  const jsonBody = String(requiredNode(workflow, 'Gemini Structure V2').parameters.jsonBody);
  assert.match(jsonBody, /^={{\s*JSON\.stringify\(/);
  const expression = jsonBody.slice(3, -2).trim();
  const presentationRequest = {
    slideCount: 10,
    topic: 'Тема с "кавычками"\nи новой строкой',
    subject: 'Информатик',
    studentName: 'Ох',
    group: '8Г',
    style: 'minimal_light',
    educationContext: { educationStage: 'school', schoolClass: '8Г' },
  };
  const serialized = Function('$', '"use strict"; return (' + expression + ');')(
    () => ({ item: { json: { presentationRequest } } }),
  ) as string;
  const body = JSON.parse(serialized) as {
    contents: Array<{ parts: Array<{ text: string }> }>;
    generationConfig: { responseSchema: unknown; responseMimeType: string };
  };
  const prompt = body.contents[0]!.parts[0]!.text;
  assert.match(prompt, /Тема с "кавычками"\nи новой строкой/);
  assert.match(prompt, /minimal_light/);
  assert.match(prompt, /schoolClass/);
  assert.match(prompt, /не придумывай статистику/i);
  assert.equal(body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(body.generationConfig.responseSchema, JSON.parse(await readFile(schemaPath, 'utf8')));
  const promptFile = await readFile(promptPath, 'utf8');
  assert.equal(promptFile.replaceAll('\r\n', '\n').trimEnd().length > 0, true);
});

test('renderer V2 workflow contains placeholders and no live secrets', async () => {
  const raw = await readFile(workflowPath, 'utf8');
  assert.doesNotMatch(raw, /AIza[0-9A-Za-z_-]{20,}/);
  assert.doesNotMatch(raw, /Bearer\s+[0-9A-Za-z_-]{20,}/);
  const workflow = JSON.parse(raw) as Workflow;
  for (const node of workflow.nodes) {
    for (const credential of Object.values(node.credentials ?? {})) {
      assert.equal(credential.id, 'REDACTED');
    }
  }
});

