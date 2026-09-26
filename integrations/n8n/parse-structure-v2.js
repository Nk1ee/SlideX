/**
 * SlideX Parse Structure V2
 *
 * This node parses Gemini structured output and joins it with trusted FSM
 * metadata. It never repairs JSON, changes layouts, truncates content or
 * invents missing fields. The renderer performs the authoritative Zod check.
 */

function requireNonBlankString(value, field) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('SLIDEX V2: отсутствует обязательное поле ' + field);
  }
  return value;
}

const geminiResponse = $input.first().json;
const candidates = geminiResponse && geminiResponse.candidates;
if (!Array.isArray(candidates) || candidates.length === 0) {
  throw new Error('SLIDEX V2: Gemini не вернул кандидатов ответа');
}

const candidate = candidates[0];
if (candidate.finishReason === 'RECITATION') {
  throw new Error('SLIDEX V2: Gemini остановил ответ из-за RECITATION');
}

const rawText = candidate && candidate.content && candidate.content.parts && candidate.content.parts[0] && candidate.content.parts[0].text;
if (typeof rawText !== 'string' || rawText.trim().length === 0) {
  throw new Error('SLIDEX V2: Gemini вернул пустой structured output');
}

let generated;
try {
  generated = JSON.parse(rawText);
} catch (error) {
  throw new Error('SLIDEX V2: structured output не является JSON: ' + (error instanceof Error ? error.message : String(error)));
}

if (!generated || typeof generated !== 'object' || Array.isArray(generated)) {
  throw new Error('SLIDEX V2: корневой JSON должен быть объектом');
}
if (!generated.presentation || typeof generated.presentation !== 'object' || Array.isArray(generated.presentation)) {
  throw new Error('SLIDEX V2: отсутствует объект presentation');
}
if (!Array.isArray(generated.slides)) {
  throw new Error('SLIDEX V2: отсутствует массив slides');
}

const fsmNode = $('FSM Engine').first().json;
const fsmRequest = fsmNode && fsmNode.presentationRequest;
if (!fsmRequest || typeof fsmRequest !== 'object' || Array.isArray(fsmRequest)) {
  throw new Error('SLIDEX V2: отсутствует trusted FSM request');
}

const topic = requireNonBlankString(fsmRequest.topic, 'FSM.topic');
const subject = requireNonBlankString(fsmRequest.subject, 'FSM.subject');
const studentName = requireNonBlankString(fsmRequest.studentName, 'FSM.studentName');
const group = requireNonBlankString(fsmRequest.group, 'FSM.group');
const style = requireNonBlankString(fsmRequest.style, 'FSM.style');
if (!Number.isInteger(fsmRequest.slideCount) || fsmRequest.slideCount < 1) {
  throw new Error('SLIDEX V2: FSM.slideCount должен быть положительным целым числом');
}
if (generated.slides.length !== fsmRequest.slideCount) {
  throw new Error('SLIDEX V2: Gemini вернул ' + generated.slides.length + ' слайдов вместо ' + fsmRequest.slideCount);
}

const chatIdValue = fsmNode.chatId !== undefined ? fsmNode.chatId : fsmRequest.chatId;
if (chatIdValue === undefined || chatIdValue === null || String(chatIdValue).length === 0) {
  throw new Error('SLIDEX V2: отсутствует chatId');
}

const request = {
  topic,
  subject,
  studentName,
  group,
  slideCount: fsmRequest.slideCount,
  style,
  ...(fsmRequest.educationContext === undefined ? {} : { educationContext: fsmRequest.educationContext })
};

const payload = {
  chatId: String(chatIdValue),
  presentation: {
    fullTopic: topic,
    displayTitle: requireNonBlankString(generated.presentation.displayTitle, 'presentation.displayTitle'),
    subject,
    studentName,
    group,
    slideCount: fsmRequest.slideCount,
    style,
    language: 'ru',
    ...(fsmRequest.educationContext === undefined ? {} : { educationContext: fsmRequest.educationContext })
  },
  slides: generated.slides
};

return [{ json: { request, payload } }];
