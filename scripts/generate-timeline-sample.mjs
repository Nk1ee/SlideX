import { mkdir, writeFile } from 'node:fs/promises';
import { assertContentQuality } from '../dist/src/qc/contentValidation.js';
import { assertLayoutPlan } from '../dist/src/qc/layoutValidation.js';
import { assertValidPptx } from '../dist/src/qc/pptxValidation.js';
import { validatePresentation } from '../dist/src/presentation/validator.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';

const noVisual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
const empty = { subtitle: '', bullets: [], cards: [], columns: [], comparison: null, statistics: null, chart: null, timeline: [], steps: [], definition: null, quote: null, sources: [] };
const request = {
  topic: 'График подготовки учебной презентации',
  subject: 'Информатика',
  studentName: 'Ох',
  group: '4',
  slideCount: 4,
  style: 'business_emerald',
};
const raw = {
  chatId: 'timeline-sample',
  presentation: {
    fullTopic: request.topic,
    displayTitle: 'Подготовка учебной презентации',
    subject: request.subject,
    studentName: request.studentName,
    group: request.group,
    slideCount: request.slideCount,
    style: request.style,
    language: 'ru',
  },
  slides: [
    { ...empty, number: 1, type: 'title', layout: 'title', title: 'Подготовка учебной презентации', visual: noVisual },
    {
      ...empty,
      number: 2,
      type: 'content',
      layout: 'timeline',
      title: 'Контрольные точки проекта',
      timeline: [
        { date: '1 октября', title: 'Черновой план', text: 'Утвердить тему, цель и последовательность слайдов.' },
        { date: '3 октября', title: 'Проверка содержания', text: 'Проверить формулировки, факты и переданные источники.' },
        { date: '5 октября', title: 'Финальная версия', text: 'Собрать PPTX и просмотреть каждый слайд после экспорта.' },
      ],
      visual: noVisual,
    },
    {
      ...empty,
      number: 3,
      type: 'sources',
      layout: 'sources',
      title: 'О тестовом материале',
      sources: [{ title: 'Синтетический календарный пример для проверки layout timeline', organization: 'SlideX' }],
      visual: noVisual,
    },
    {
      ...empty,
      number: 4,
      type: 'conclusion',
      layout: 'conclusion',
      title: 'Что проверяет этот образец',
      cards: [
        { title: 'Дата отдельно', text: 'Каждая контрольная точка сохраняет собственную дату.' },
        { title: 'Одна ось', text: 'События объединены общей временной линией.' },
        { title: 'Без выдуманных этапов', text: 'Renderer использует только переданный timeline.' },
      ],
      visual: noVisual,
    },
  ],
};

const presentation = validatePresentation(raw, request);
assertContentQuality(presentation);
assertLayoutPlan(presentation, new Set(['title', 'timeline', 'sources', 'conclusion']));
const bytes = await renderPresentation(presentation);
await assertValidPptx(bytes, { expectedSlideCount: 4, imagesExpected: false });
await mkdir('work', { recursive: true });
await writeFile('work/timeline-sample.pptx', bytes);
await writeFile('work/timeline-sample.json', JSON.stringify(presentation, null, 2));
console.log('Created work/timeline-sample.pptx with 4 validated slides.');
