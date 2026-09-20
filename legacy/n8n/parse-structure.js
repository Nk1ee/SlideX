/**
 * SLIDEX V2.5: Parse Structure & Strict Metadata Isolation
 */

function parseGeminiJson(rawInput) {
  if (!rawInput || typeof rawInput !== "string") {
    throw new Error("SLIDEX ERROR: Пустой ответ от Gemini.");
  }

  let s = rawInput.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try { return JSON.parse(s); } catch (e) {}

  s = s.replace(/("(?:[^"\\]|\\.)*")(\s*[\r\n]+\s*)(")/g, "$1,$2$3");
  s = s.replace(/(\b\d+\b|\btrue\b|\bfalse\b|\bnull\b)(\s*[\r\n]+\s*)(")/g, "$1,$2$3");
  s = s.replace(/([}\]])(\s*[\r\n]+\s*)([{"\w])/g, "$1,$2$3");
  s = s.replace(/,\s*([}\]])/g, "$1");

  try { return JSON.parse(s); } catch (err) {
    throw new Error(`SLIDEX ERROR: Ошибка JSON: ${err.message}`);
  }
}

const rawCandidates = $input.first().json?.candidates;
if (!rawCandidates || !Array.isArray(rawCandidates) || rawCandidates.length === 0) {
  throw new Error("SLIDEX ERROR: Модель не вернула кандидатов ответа.");
}

const candidate = rawCandidates[0];
if (candidate.finishReason === "RECITATION") {
  throw new Error("SLIDEX ERROR: Блокировка авторских прав (RECITATION). Повторите запуск.");
}

const rawText = candidate.content?.parts?.[0]?.text;
if (!rawText) throw new Error("SLIDEX ERROR: Пустой текст ответа.");

const parsed = parseGeminiJson(rawText);
if (!parsed || !Array.isArray(parsed.slides)) {
  throw new Error("SLIDEX ERROR: В ответе нет массива 'slides'.");
}

// Извлекаем FSM метаданные строго без изменений
const fsmRequest = $("FSM Engine").item.json?.presentationRequest || {};
const chatId = $("FSM Engine").item.json?.chatId || fsmRequest.chatId;
const requestedCount = parseInt(fsmRequest.slideCount, 10) || 13;

const presentationMeta = {
  title: (parsed.presentation?.title || fsmRequest.topic || "Презентация").trim(),
  fullTopic: (fsmRequest.topic || "").trim(),
  subtitle: (parsed.presentation?.subtitle || "").trim(),
  // ПОЛЬЗОВАТЕЛЬСКИЕ ДАННЫЕ СТРОГО ИЗ FSM:
  subject: fsmRequest.subject,       // "Информатик" остается "Информатик"
  studentName: fsmRequest.studentName, // "Ох" остается "Ох"
  group: fsmRequest.group,           // "4" остается "4"
  slideCount: requestedCount,
  style: fsmRequest.style || "deep_blue",
  language: fsmRequest.language || "ru"
};

// Проверяем количество слайдов
if (parsed.slides.length !== requestedCount) {
  throw new Error(`SLIDEX ERROR: Ожидалось ${requestedCount} слайдов, сгенерировано ${parsed.slides.length}. Повторите запуск.`);
}

const sanitizedSlides = parsed.slides.map((s, index) => {
  const slideNum = index + 1;
  const isFirst = index === 0;
  const isLast = index === requestedCount - 1;
  const titleLower = (s.title || "").toLowerCase();

  let layout = (s.layout || "two_column").toLowerCase().trim();

  // Принудительная изоляция финала
  if (isFirst) {
    layout = "title";
  } else if (isLast || /заключение|вывод|итог/i.test(titleLower)) {
    layout = "conclusion";
  } else if (/источник|литератур|библиограф|sources/i.test(titleLower)) {
    layout = "sources";
  }

  let title = (s.title || `Раздел ${slideNum}`).trim().replace(/\s+-\s+/g, " — ");

  let bullets = Array.isArray(s.bullets) ? s.bullets : [];
  bullets = bullets
    .map(b => (typeof b === "string" ? b.trim().replace(/\s+-\s+/g, " — ") : Object.values(b).join(" ")))
    .filter(b => b.length > 0)
    .slice(0, 3);

  // Визуал
  const visualRaw = s.visual || {};
  const isNoPhoto = layout === "conclusion" || layout === "sources" || isLast;
  const needed = Boolean(visualRaw.needed && !isNoPhoto);
  const query_en = (visualRaw.query_en || "").replace(/[^a-zA-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  return {
    number: slideNum,
    type: s.type || layout,
    layout,
    title,
    bullets,
    cards: Array.isArray(s.cards) && s.cards.length >= 3 ? s.cards.slice(0, 3) : null,
    comparison: s.comparison || null,
    statistics: s.statistics || null,
    timeline: s.timeline || null,
    visual: {
      needed,
      query_en,
      placement: visualRaw.placement || "right"
    },
    sources: Array.isArray(s.sources) ? s.sources.slice(0, 4) : []
  };
});

return [{
  json: {
    chatId,
    presentation: presentationMeta,
    slides: sanitizedSlides
  }
}];