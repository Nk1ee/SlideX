import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const argumentsMap = new Map();
for (let index = 2; index < process.argv.length; index += 2) {
  argumentsMap.set(process.argv[index], process.argv[index + 1]);
}

const sourcePath = resolve(argumentsMap.get('--source') ?? 'integrations/n8n/workflow.education-context.json');
const parserPath = resolve(argumentsMap.get('--parser') ?? 'integrations/n8n/parse-structure-v2.js');
const prepareParserPath = resolve(argumentsMap.get('--prepare-parser') ?? 'integrations/n8n/prepare-structure-v2.js');
const promptPath = resolve(argumentsMap.get('--prompt') ?? 'integrations/n8n/gemini-prompt-v2.txt');
const schemaPath = resolve(argumentsMap.get('--schema') ?? 'integrations/n8n/gemini-response-schema-v2.json');
const outputPath = resolve(argumentsMap.get('--output') ?? 'integrations/n8n/workflow.renderer-v2.json');

const [sourceText, parserCode, prepareParserCode, promptText, schemaText] = await Promise.all([
  readFile(sourcePath, 'utf8'),
  readFile(parserPath, 'utf8'),
  readFile(prepareParserPath, 'utf8'),
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

function repairPromptExpression(basePrompt) {
  const repair = "$('Prepare Structure V2').first().json.repair";
  return [
    JSON.stringify(basePrompt.trimEnd() + '\n\nREPAIR MODE. Предыдущая структура содержит неверное количество слайдов. Верни полный исправленный JSON. Сохрани пригодные слайды, но добавь или перестрой содержательный слайд по теме. Не создавай пустой filler и не выдумывай факты.\nОжидалось слайдов: '),
    'String(' + repair + '.expectedSlideCount)',
    JSON.stringify('\nПолучено слайдов: '),
    'String(' + repair + '.actualSlideCount)',
    JSON.stringify('\nПредыдущий JSON: '),
    'JSON.stringify(' + repair + '.generated)',
  ].join(' + ');
}

function geminiRepairBodyExpression(basePrompt, schema) {
  const marker = '__SLIDEX_V2_REPAIR_PROMPT__';
  const body = {
    contents: [{ role: 'user', parts: [{ text: marker }] }],
    systemInstruction: {
      parts: [{
        text: 'Ты исправляешь структуру SlideX после строгой проверки. Верни полный JSON и ровно требуемое количество слайдов. Не изменяй пользовательские метаданные и не выдумывай факты или источники.',
      }],
    },
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };
  const objectCode = JSON.stringify(body, null, 2).replace(JSON.stringify(marker), '(' + repairPromptExpression(basePrompt) + ')');
  return '={{ JSON.stringify(' + objectCode + ') }}';
}

function visualRepairPromptExpression(basePrompt) {
  const repair = "$('Prepare Image Repair V2').first().json.repair";
  return [
    JSON.stringify(basePrompt.trimEnd() + '\n\nIMAGE REPAIR MODE. Renderer не нашёл достаточно релевантное и лицензированное изображение для одного слайда. Верни полный исправленный JSON с тем же количеством слайдов. Сохрани факты, смысл и порядок всех слайдов. Перестрой только указанный слайд в подходящий layout без изображения: hero, two_column, three_cards, comparison, process или definition. Используй только уже переданное содержание этого слайда, не добавляй новых фактов, статистики, цитат или источников. Для исправленного слайда установи visual: needed=false, type=none, concept="", query_en="", placement=supporting. Не используй image_text для исправленного слайда.\nНомер слайда: '),
    'String(' + repair + '.failedSlideNumber)',
    JSON.stringify('\nОшибка renderer: '),
    'String(' + repair + '.rendererMessage)',
    JSON.stringify('\nПредыдущий JSON: '),
    'JSON.stringify(' + repair + '.generated)',
  ].join(' + ');
}

function geminiVisualRepairBodyExpression(basePrompt, schema) {
  const marker = '__SLIDEX_V2_VISUAL_REPAIR_PROMPT__';
  const body = {
    contents: [{ role: 'user', parts: [{ text: marker }] }],
    systemInstruction: {
      parts: [{
        text: 'Ты исправляешь только композицию слайда SlideX после неудачного поиска изображения. Сохрани учебный смысл и все пользовательские metadata. Не выдумывай факты или источники. Верни полный JSON.',
      }],
    },
    generationConfig: {
      temperature: 0.15,
      maxOutputTokens: 16384,
      responseMimeType: 'application/json',
      responseSchema: schema,
    },
  };
  const objectCode = JSON.stringify(body, null, 2).replace(JSON.stringify(marker), '(' + visualRepairPromptExpression(basePrompt) + ')');
  return '={{ JSON.stringify(' + objectCode + ') }}';
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
parseNode.parameters.jsCode = prepareParserCode.trimEnd();

const notifyNode = requiredNode('Notify Structure Ready');
notifyNode.parameters.chatId = "={{ $('Select Final Structure V2').item.json.payload.chatId }}";
notifyNode.parameters.text = "=📝 Структура презентации прошла V2 parsing.\\nСлайдов: {{ $('Select Final Structure V2').item.json.payload.presentation.slideCount }}\\n\\nПроверяю контракт и создаю PPTX...";

const rendererNode = requiredNode('Generate PPTX File');
rendererNode.parameters.url = 'https://example.invalid/slidex-renderer-v2';
rendererNode.parameters.authentication = 'genericCredentialType';
rendererNode.parameters.genericAuthType = 'httpHeaderAuth';
rendererNode.parameters.jsonBody = '={{ $json }}';
rendererNode.parameters.options = { response: { response: { responseFormat: 'autodetect', neverError: true } } };
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
  "if (!binary) {",
  "  const rendererError = $input.first().json?.error;",
  "  const detail = rendererError?.message ? ': ' + rendererError.message : '';",
  "  throw new Error('QC FAILED: повторный render не вернул PPTX' + detail);",
  "}",
  "const isPptx = binary.fileExtension === 'pptx' || binary.mimeType?.includes('presentationml');",
  "if (!isPptx) throw new Error('QC FAILED: Неверный MIME или расширение PPTX');",
  "const envelope = $input.first().json;",
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
sendNode.parameters.chatId = '={{ $json.chatId }}';
sendNode.parameters.additionalFields.caption = '=Готово! 🔥\n\nТвоя презентация:\n«{{ $json.title }}»\n\n📊 Слайдов: {{ $json.slideCount }}\n👤 Автор: {{ $json.studentName }} (гр. {{ $json.group }})';

workflow = transformNodeReferences(workflow, [
  ['Gemini-Structure', 'Gemini Structure V2'],
  ['Parse Structure', 'Prepare Structure V2'],
  ['Generate PPTX File', 'Generate PPTX V2'],
]);

const preparedGeminiNode = requiredNode('Gemini Structure V2');
const repairGeminiNode = structuredClone(preparedGeminiNode);
repairGeminiNode.id = 'fa69a73e-c7a2-4cf2-a8ac-21ce5d6af102';
repairGeminiNode.name = 'Gemini Repair V2';
repairGeminiNode.position = [2256, -96];
repairGeminiNode.parameters.jsonBody = geminiRepairBodyExpression(promptText, responseSchema);

const checkRepairNode = {
  id: 'e9db11be-f6d6-40b9-98cb-76d8dcf35d54',
  name: 'Check Structure Repair V2',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.3,
  position: [2032, 64],
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
      conditions: [{
        id: '65911f75-b2a7-4226-8074-6c8728e71754',
        leftValue: '={{ $json.needsRepair }}',
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  },
};

const parseRepairNode = {
  id: 'be68f33e-65ad-4cfe-8545-bc817f6759da',
  name: 'Parse Repaired Structure V2',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2448, -96],
  parameters: { jsCode: parserCode.trimEnd() },
};

const selectFinalNode = {
  id: '5ce028ee-24b9-4bf8-a28d-b70fa4ef299c',
  name: 'Select Final Structure V2',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [2640, 64],
  parameters: {
    jsCode: [
      "const item = $input.first();",
      "if (item.json.needsRepair === true) throw new Error('SLIDEX V2: repair result was not strictly parsed');",
      'return [item];',
    ].join('\n'),
  },
};

const selectRenderEnvelopeNode = {
  id: 'f0c9a2b5-d62f-42d9-aed7-cdcd2dc1fc31',
  name: 'Select Render Envelope V2',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [3040, 64],
  parameters: { jsCode: "return [{ json: $('Select Final Structure V2').first().json }];" },
};

const checkRenderSuccessNode = {
  id: '1d4e20b0-22c5-479b-b9fd-aa7402a3cf9d',
  name: 'Check Render Success V2',
  type: 'n8n-nodes-base.if',
  typeVersion: 2.3,
  position: [3456, 64],
  parameters: {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 3 },
      conditions: [{
        id: '58701b30-295c-4a1c-826c-7712dbaf245c',
        leftValue: '={{ Boolean($binary && $binary.data) }}',
        rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true },
      }],
      combinator: 'and',
    },
    options: {},
  },
};

const prepareImageRepairNode = {
  id: '7f7e3475-a437-441c-a242-85f9f9c55925',
  name: 'Prepare Image Repair V2',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [3664, 224],
  parameters: {
    jsCode: [
      "const body = $input.first().json;",
      "const error = body && body.error;",
      "if (!error || error.code !== 'IMAGE_NOT_FOUND') {",
      "  const code = error && error.code ? String(error.code) : 'UNKNOWN_RENDER_ERROR';",
      "  const message = error && error.message ? ': ' + String(error.message) : '';",
      "  throw new Error('SLIDEX V2: renderer отклонил презентацию [' + code + ']' + message);",
      "}",
      "if (!Number.isInteger(error.slideNumber) || error.slideNumber < 1) throw new Error('SLIDEX V2: IMAGE_NOT_FOUND не содержит корректный slideNumber');",
      "const envelope = $('Select Final Structure V2').first().json;",
      "const failedSlide = envelope.payload.slides.find((slide) => slide.number === error.slideNumber);",
      "if (!failedSlide || failedSlide.layout !== 'image_text') throw new Error('SLIDEX V2: renderer указал неподходящий слайд для image repair');",
      "return [{ json: { repair: {",
      "  failedSlideNumber: error.slideNumber,",
      "  rendererMessage: String(error.message || 'Image not found'),",
      "  generated: {",
      "    presentation: { displayTitle: envelope.payload.presentation.displayTitle },",
      "    slides: envelope.payload.slides",
      "  }",
      "} } }];",
    ].join('\n'),
  },
};

const visualRepairGeminiNode = structuredClone(preparedGeminiNode);
visualRepairGeminiNode.id = '2fb09039-a826-4ddc-bfe8-769ab18581b6';
visualRepairGeminiNode.name = 'Gemini Image Repair V2';
visualRepairGeminiNode.position = [3872, 224];
visualRepairGeminiNode.parameters.jsonBody = geminiVisualRepairBodyExpression(promptText, responseSchema);

const parseVisualRepairNode = {
  id: 'c727fa15-5e85-411d-9b73-ea12729e553c',
  name: 'Parse Image Repair V2',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [4080, 224],
  parameters: { jsCode: parserCode.trimEnd() },
};

const validateVisualRepairNode = {
  id: 'f897dafd-88f6-47d2-aea3-689a3f052c1f',
  name: 'Validate Image Repair V2',
  type: 'n8n-nodes-base.code',
  typeVersion: 2,
  position: [4288, 224],
  parameters: {
    jsCode: [
      "const item = $input.first();",
      "const failedSlideNumber = $('Prepare Image Repair V2').first().json.repair.failedSlideNumber;",
      "const slide = item.json.payload.slides.find((candidate) => candidate.number === failedSlideNumber);",
      "if (!slide) throw new Error('SLIDEX V2: image repair потерял проблемный слайд');",
      "if (slide.layout === 'image_text' || slide.visual?.needed === true) throw new Error('SLIDEX V2: image repair не заменил недоступное изображение');",
      "return [item];",
    ].join('\n'),
  },
};

const retryRendererNode = structuredClone(rendererNode);
retryRendererNode.id = 'e4ce68c4-046a-459b-802a-4c83880d1d36';
retryRendererNode.name = 'Generate PPTX After Image Repair V2';
retryRendererNode.position = [4496, 224];
retryRendererNode.parameters.jsonBody = '={{ $json }}';

workflow.nodes.push(checkRepairNode, repairGeminiNode, parseRepairNode, selectFinalNode, selectRenderEnvelopeNode, checkRenderSuccessNode, prepareImageRepairNode, visualRepairGeminiNode, parseVisualRepairNode, validateVisualRepairNode, retryRendererNode);
for (const node of workflow.nodes) {
  if (node.name === 'Notify Structure Ready') node.position = [2832, 64];
  if (node.name === 'Generate PPTX V2') node.position = [3248, 64];
  if (node.name === 'Quality Control Gate') node.position = [4704, 64];
  if (node.name === 'Send a document') node.position = [4912, 64];
}
workflow.connections['Prepare Structure V2'] = { main: [[{ node: 'Check Structure Repair V2', type: 'main', index: 0 }]] };
workflow.connections['Check Structure Repair V2'] = { main: [
  [{ node: 'Gemini Repair V2', type: 'main', index: 0 }],
  [{ node: 'Select Final Structure V2', type: 'main', index: 0 }],
] };
workflow.connections['Gemini Repair V2'] = { main: [[{ node: 'Parse Repaired Structure V2', type: 'main', index: 0 }]] };
workflow.connections['Parse Repaired Structure V2'] = { main: [[{ node: 'Select Final Structure V2', type: 'main', index: 0 }]] };
workflow.connections['Select Final Structure V2'] = { main: [[{ node: 'Notify Structure Ready', type: 'main', index: 0 }]] };
workflow.connections['Notify Structure Ready'] = { main: [[{ node: 'Select Render Envelope V2', type: 'main', index: 0 }]] };
workflow.connections['Select Render Envelope V2'] = { main: [[{ node: 'Generate PPTX V2', type: 'main', index: 0 }]] };
workflow.connections['Generate PPTX V2'] = { main: [[{ node: 'Check Render Success V2', type: 'main', index: 0 }]] };
workflow.connections['Check Render Success V2'] = { main: [
  [{ node: 'Quality Control Gate', type: 'main', index: 0 }],
  [{ node: 'Prepare Image Repair V2', type: 'main', index: 0 }],
] };
workflow.connections['Prepare Image Repair V2'] = { main: [[{ node: 'Gemini Image Repair V2', type: 'main', index: 0 }]] };
workflow.connections['Gemini Image Repair V2'] = { main: [[{ node: 'Parse Image Repair V2', type: 'main', index: 0 }]] };
workflow.connections['Parse Image Repair V2'] = { main: [[{ node: 'Validate Image Repair V2', type: 'main', index: 0 }]] };
workflow.connections['Validate Image Repair V2'] = { main: [[{ node: 'Generate PPTX After Image Repair V2', type: 'main', index: 0 }]] };
workflow.connections['Generate PPTX After Image Repair V2'] = { main: [[{ node: 'Quality Control Gate', type: 'main', index: 0 }]] };

for (const node of workflow.nodes) {
  for (const credential of Object.values(node.credentials ?? {})) {
    credential.id = 'REDACTED';
  }
  if ('webhookId' in node) node.webhookId = 'REDACTED';
}

await writeFile(outputPath, JSON.stringify(workflow, null, 2) + '\n', 'utf8');
console.log('Generated inactive n8n V2 workflow: ' + outputPath);
