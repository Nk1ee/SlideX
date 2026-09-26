import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsMap.set(process.argv[index], process.argv[index + 1]);
}

const sourcePath = resolve(argumentsMap.get('--source') ?? 'integrations/n8n/workflow.education-context.json');
const parserPath = resolve(argumentsMap.get('--parser') ?? 'integrations/n8n/parse-structure-v2.js');
const promptPath = resolve(argumentsMap.get('--prompt') ?? 'integrations/n8n/gemini-prompt-v2.txt');
const schemaPath = resolve(argumentsMap.get('--schema') ?? 'integrations/n8n/gemini-response-schema-v2.json');
const outputPath = resolve(argumentsMap.get('--output') ?? 'integrations/n8n/workflow.renderer-v2.json');

const [sourceText, parserCode, promptText, schemaText] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(parserPath, 'utf8'),
  readFile(promptPath, 'utf8'),
  readFile(schemaPath, 'utf8'),
]);

let workflow = JSON.parse(sourceText);
const responseSchema = JSON.parse(schemaText);

function requiredNode(name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error('Required node is missing: ' + name);
  return node;
}

function transformNodeReferences(value, replacements) {
  const exact = new Map(replacements);
  const transformString = (input) => {
    if (exact.has(input)) return exact.get(input);
    return replacements.reduce(
      (current, pair) => current.replaceAll("$('" + pair[0] + "')", "$('" + pair[1] + "')"),
      input,
    );
  };
  if (typeof value === 'string') return transformString(value);
  if (Array.isArray(value)) return value.map((item) => transformNodeReferences(item, replacements));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      transformString(key),
      transformNodeReferences(item, replacements),
    ]));
  }
  return value;
}

function dynamicPromptExpression(basePrompt) {
  const request = "$('FSM Engine').item.json.presentationRequest";
  return [
    JSON.stringify(basePrompt.trimEnd() + '\n\nПараметры текущей презентации:\nТема: '),
    'String(' + request + '.topic)',
    JSON.stringify('\nПредмет: '),
    'String(' + request + '.subject)',
    JSON.stringify('\nКоличество слайдов: '),
    'String(' + request + '.slideCount)',
    JSON.stringify('\nСтиль оформления: '),
    'String(' + request + '.style)',
    JSON.stringify('\nУчебный контекст: '),
    'String(JSON.stringify(' + request + '.educationContext ?? null))',
  ].join(' + ');
}

function geminiBodyExpression(basePrompt, schema) {
  const marker = '__SLIDEX_V2_PROMPT__';
  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: marker }],
    }],
    systemInstruction: {
      parts: [{
        text: 'Ты — методист и презентационный архитектор SlideX. Следуй JSON-контракту буквально. Пиши учебный текст, но не изменяй пользовательские метаданные и не выдумывай факты или источники.',
      }],
    },
    generationConfig: {
      temperature: 0.35,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };
  const objectCode = JSON.stringify(body, null, 2).replace(JSON.stringify(marker), '(' + dynamicPromptExpression(basePrompt) + ')');
  return '={{ JSON.stringify(' + objectCode + ') }}';
}

workflow.name = 'SlideX — renderer v2 staging';
workflow.active = false;

const geminiNode = requiredNode('Gemini-Structure');
geminiNode.parameters.jsonBody = geminiBodyExpression(promptText, responseSchema);
geminiNode.parameters.authentication = 'genericCredentialType';
geminiNode.parameters.genericAuthType = 'httpHeaderAuth';
delete geminiNode.parameters.sendHeaders;
delete geminiNode.parameters.headerParameters;
geminiNode.credentials = {
  httpHeaderAuth: {
    id: 'REDACTED',
    name: 'Configure SlideX V2 Gemini credential',
  },
};
geminiNode.retryOnFail = true;
geminiNode.maxTries = 3;
geminiNode.waitBetweenTries = 5000;

const parseNode = requiredNode('Parse Structure');
parseNode.parameters.jsCode = parserCode.trimEnd();

const notifyNode = requiredNode('Notify Structure Ready');
notifyNode.parameters.chatId = "={{ $('Parse Structure').item.json.payload.chatId }}";
notifyNode.parameters.text = "=📝 Структура презентации прошла V2 parsing.\\nСлайдов: {{ $('Parse Structure').item.json.payload.presentation.slideCount }}\\n\\nПроверяю контракт и создаю PPTX...";

const rendererNode = requiredNode('Generate PPTX File');
rendererNode.parameters.url = 'https://example.invalid/slidex-renderer-v2';
rendererNode.parameters.authentication = 'genericCredentialType';
rendererNode.parameters.genericAuthType = 'httpHeaderAuth';
rendererNode.parameters.jsonBody = "={{ $('Parse Structure').first().json }}";
rendererNode.credentials = {
  httpHeaderAuth: {
    id: 'REDACTED',
    name: 'Configure SlideX V2 bearer credential',
  },
};
rendererNode.retryOnFail = true;
rendererNode.maxTries = 3;
rendererNode.waitBetweenTries = 5000;

const qualityNode = requiredNode('Quality Control Gate');
qualityNode.parameters.jsCode = [
  "const binary = $input.first().binary?.data;",
  "if (!binary) throw new Error('QC FAILED: Бинарный файл PPTX отсутствует в ответе');",
  "const isPptx = binary.fileExtension === 'pptx' || binary.mimeType?.includes('presentationml');",
  "if (!isPptx) throw new Error('QC FAILED: Неверный MIME или расширение PPTX');",
  "const envelope = $('Parse Structure').first().json;",
  "const meta = envelope.payload.presentation;",
  "return [{",
  "  json: {",
  "    chatId: envelope.payload.chatId,",
  "    title: meta.displayTitle,",
  "    slideCount: meta.slideCount,",
  "    studentName: meta.studentName,",
  "    group: meta.group,",
  "    fileSize: binary.fileSize",
  "  },",
  "  binary: $input.first().binary",
  "}];",
].join('\n');

const sendNode = requiredNode('Send a document');
sendNode.parameters.chatId = "={{ $('Parse Structure').item.json.payload.chatId }}";
sendNode.parameters.additionalFields.caption = "=Готово! 🔥\\n\\nТвоя презентация:\\n«{{ $('Parse Structure').first().json.payload.presentation.displayTitle }}»\\n\\n📊 Слайдов: {{ $('Parse Structure').first().json.payload.presentation.slideCount }}\\n👤 Автор: {{ $('Parse Structure').first().json.payload.presentation.studentName }} (гр. {{ $('Parse Structure').first().json.payload.presentation.group }})";

workflow = transformNodeReferences(workflow, [
  ['Gemini-Structure', 'Gemini Structure V2'],
  ['Parse Structure', 'Parse Structure V2'],
  ['Generate PPTX File', 'Generate PPTX V2'],
]);

for (const node of workflow.nodes) {
  for (const credential of Object.values(node.credentials ?? {})) {
    credential.id = 'REDACTED';
  }
  if ('webhookId' in node) node.webhookId = 'REDACTED';
}

await writeFile(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log('Generated inactive n8n V2 workflow: ' + outputPath);
