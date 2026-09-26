import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsMap.set(process.argv[index], process.argv[index + 1]);
}

const sourcePath = resolve(argumentsMap.get('--source') ?? 'legacy/n8n/workflow.json');
const fsmPath = resolve(argumentsMap.get('--fsm') ?? 'integrations/n8n/fsm-engine.education-context.js');
const outputPath = resolve(argumentsMap.get('--output') ?? 'integrations/n8n/workflow.education-context.json');
const themePreviewUrl = 'https://raw.githubusercontent.com/Nk1ee/SlideX/main/docs/themes/telegram-theme-choice.png';

const [sourceText, fsmCode] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(fsmPath, 'utf8'),
]);
const workflow = JSON.parse(sourceText);

function requiredNode(name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Required legacy node is missing: ${name}`);
  return node;
}

function replaceOnce(source, search, replacement, description) {
  if (!source.includes(search)) throw new Error(`Cannot migrate ${description}: source fragment not found`);
  return source.replace(search, replacement);
}

function interpolatedTextExpression(text) {
  const parts = [];
  const expressionPattern = /{{\s*([\s\S]*?)\s*}}/g;
  let cursor = 0;
  for (const match of text.matchAll(expressionPattern)) {
    parts.push(JSON.stringify(text.slice(cursor, match.index)));
    parts.push(`String(${match[1]})`);
    cursor = (match.index ?? 0) + match[0].length;
  }
  parts.push(JSON.stringify(text.slice(cursor)));
  return parts.filter((part) => part !== '""').join(' + ');
}

function safeJsonBodyExpression(jsonBody) {
  if (!jsonBody.startsWith('=')) throw new Error('Gemini JSON body must be an n8n expression');
  const body = JSON.parse(jsonBody.slice(1));
  const prompt = body.contents?.[0]?.parts?.[0]?.text;
  if (typeof prompt !== 'string') throw new Error('Gemini JSON body is missing the user prompt');
  const marker = '__SLIDEX_SAFE_PROMPT__';
  body.contents[0].parts[0].text = marker;
  const objectCode = JSON.stringify(body, null, 2).replace(JSON.stringify(marker), `(${interpolatedTextExpression(prompt)})`);
  return `={{ JSON.stringify(${objectCode}) }}`;
}

workflow.name = 'SlideX — education context staging';
workflow.active = false;

requiredNode('FSM Engine').parameters.jsCode = fsmCode.trimEnd();

const updateNode = requiredNode('Update a row');
const updateFields = updateNode.parameters.fieldsUi.fieldValues;
const stateField = updateFields.find((field) => field.fieldId === 'state');
stateField.fieldValue = "={{ $('FSM Engine').item.json.updateFields.state || $('Get a row').item.json.state }}";

for (const [fieldId, updateField] of [
  ['education_stage', 'education_stage'],
  ['school_class', 'school_class'],
  ['course', 'course'],
  ['presentation_style', 'presentation_style'],
]) {
  updateFields.push({
    fieldId,
    fieldValue: `={{ $('FSM Engine').item.json.updateFields.${updateField} || $('Get a row').item.json.${fieldId} }}`,
  });
}

const parseNode = requiredNode('Parse Structure');
let parseCode = parseNode.parameters.jsCode;
parseCode = replaceOnce(
  parseCode,
  'const requestedCount = parseInt(fsmRequest.slideCount, 10) || 13;',
  'const requestedCount = fsmRequest.slideCount;\nif (!Number.isInteger(requestedCount) || requestedCount < 1) {\n  throw new Error("SLIDEX ERROR: Некорректное число слайдов в trusted FSM request.");\n}',
  'strict slide count',
);
parseCode = replaceOnce(parseCode, 'fullTopic: (fsmRequest.topic || "").trim(),', 'fullTopic: fsmRequest.topic,', 'topic preservation');
parseCode = replaceOnce(
  parseCode,
  'style: fsmRequest.style || "deep_blue",\n  language: fsmRequest.language || "ru"',
  'style: fsmRequest.style,\n  language: "ru",\n  educationContext: fsmRequest.educationContext',
  'education metadata preservation',
);
parseNode.parameters.jsCode = parseCode;

const geminiNode = requiredNode('Gemini-Structure');
let geminiBody = geminiNode.parameters.jsonBody;
geminiBody = replaceOnce(
  geminiBody,
  'Спроектируй элитную университетскую презентацию',
  'Спроектируй качественную учебную презентацию',
  'education-neutral Gemini role',
);
geminiBody = replaceOnce(
  geminiBody,
  "Автор: '{{ $('FSM Engine').item.json.presentationRequest.studentName }}' (группа {{ $('FSM Engine').item.json.presentationRequest.group }}).\\n\\nЖЕСТКИЕ",
  "Автор: '{{ $('FSM Engine').item.json.presentationRequest.studentName }}' (группа или класс {{ $('FSM Engine').item.json.presentationRequest.group }}).\\nУчебный контекст: {{ JSON.stringify($('FSM Engine').item.json.presentationRequest.educationContext) }}. Адаптируй сложность языка и примеров к этой ступени, не угадывай возраст по группе.\\n\\nЖЕСТКИЕ",
  'trusted education context in Gemini prompt',
);
geminiBody = replaceOnce(
  geminiBody,
  'создать глубокую, разнообразную и взрослую академическую презентацию.',
  'создать глубокую и разнообразную учебную презентацию, адаптированную к переданному уровню обучения.',
  'education-aware system instruction',
);
geminiNode.parameters.jsonBody = safeJsonBodyExpression(geminiBody);

for (const nodeName of ['Gemini-Structure', 'Generate PPTX File']) {
  const node = requiredNode(nodeName);
  node.retryOnFail = true;
  node.maxTries = 3;
  node.waitBetweenTries = 5000;
}

const checkPhotoNode = {
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
      conditions: [{
        id: '6c402db9-8b5b-4c85-a998-96704ed34e0f',
        leftValue: "={{ $('FSM Engine').item.json.replyPhotoAsset !== null }}",
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  },
  type: 'n8n-nodes-base.if',
  typeVersion: 2.3,
  position: [1104, 64],
  id: 'd1ce28df-01ba-4ae6-96d5-e95dbed740f7',
  name: 'Check Reply Photo',
};

const sourceTelegramNode = requiredNode('Send Bot Reply');
const sendPhotoNode = {
  parameters: {
    resource: 'message',
    operation: 'sendPhoto',
    chatId: "={{ $('FSM Engine').item.json.chatId }}",
    binaryData: false,
    file: themePreviewUrl,
    additionalFields: {
      caption: 'Варианты оформления SlideX. Отправьте номер от 1 до 8.',
    },
  },
  type: 'n8n-nodes-base.telegram',
  typeVersion: 1.2,
  position: [1280, -96],
  id: '137790cd-c23b-41fb-9b31-44d4d692a926',
  name: 'Send Theme Choice Photo',
  credentials: sourceTelegramNode.credentials,
};

workflow.nodes.push(checkPhotoNode, sendPhotoNode);

requiredNode('Check If Ready').position = [1456, 64];
for (const [name, position] of [
  ['Gemini-Structure', [1648, 64]],
  ['Parse Structure', [1840, 64]],
  ['Notify Structure Ready', [2032, 64]],
  ['Generate PPTX File', [2256, 64]],
  ['Quality Control Gate', [2480, 64]],
  ['Send a document', [2688, 64]],
]) {
  requiredNode(name).position = position;
}

workflow.connections['Send Bot Reply'] = {
  main: [[{ node: 'Check Reply Photo', type: 'main', index: 0 }]],
};
workflow.connections['Check Reply Photo'] = {
  main: [
    [{ node: 'Send Theme Choice Photo', type: 'main', index: 0 }],
    [{ node: 'Check If Ready', type: 'main', index: 0 }],
  ],
};
workflow.connections['Send Theme Choice Photo'] = {
  main: [[{ node: 'Check If Ready', type: 'main', index: 0 }]],
};

await writeFile(outputPath, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
console.log(`Generated inactive n8n workflow: ${outputPath}`);
