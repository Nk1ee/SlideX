import { mkdir, writeFile } from 'node:fs/promises';
import { assertContentQuality } from '../dist/src/qc/contentValidation.js';
import { assertLayoutPlan } from '../dist/src/qc/layoutValidation.js';
import { assertValidPptx } from '../dist/src/qc/pptxValidation.js';
import { validatePresentation } from '../dist/src/presentation/validator.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';

const noVisual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
const empty = { subtitle: '', bullets: [], cards: [], columns: [], comparison: null, statistics: null, chart: null, timeline: [], steps: [], definition: null, quote: null, sources: [] };
const request = {
  topic: 'Сравнение двух форм учебного обсуждения',
  subject: 'Информатика',
  studentName: 'Ох',
  group: '4',
  slideCount: 4,
  style: 'dynamic_violet',
};
const raw = {
  chatId: 'comparison-sample',
  presentation: {
    fullTopic: request.topic,
    displayTitle: 'Формы учебного обсуждения',
    subject: request.subject,
    studentName: request.studentName,
    group: request.group,
    slideCount: request.slideCount,
    style: request.style,
    language: 'ru',
  },
  slides: [
    { ...empty, number: 1, type: 'title', layout: 'title', title: 'Формы учебного обсуждения', visual: noVisual },
    {
      ...empty,
      number: 2,
      type: 'content',
      layout: 'comparison',
      title: 'Когда происходит взаимодействие',
      comparison: {
        left: { title: 'Очное обсуждение', items: ['Участники находятся в одной аудитории', 'Ответы звучат в реальном времени', 'Материалы фиксирует ведущий'] },
        right: { title: 'Асинхронное обсуждение', items: ['Участники отвечают в разное время', 'Сообщения сохраняются в общем пространстве', 'Материалы доступны для повторного чтения'] },
      },
      visual: noVisual,
    },
    {
      ...empty,
      number: 3,
      type: 'sources',
      layout: 'sources',
      title: 'О тестовом материале',
      sources: [{ title: 'Синтетический пример для проверки layout comparison', organization: 'SlideX' }],
      visual: noVisual,
    },
    {
      ...empty,
      number: 4,
      type: 'conclusion',
      layout: 'conclusion',
      title: 'Что проверяет этот образец',
      cards: [
        { title: 'Две стороны', text: 'Обе части сравнения сохраняют title и items.' },
        { title: 'Явная связь', text: 'Маркер VS показывает сопоставление, а не два независимых блока.' },
        { title: 'Без fallback', text: 'Renderer не создаёт отсутствующие критерии сравнения.' },
      ],
      visual: noVisual,
    },
  ],
};

const presentation = validatePresentation(raw, request);
assertContentQuality(presentation);
assertLayoutPlan(presentation, new Set(['title', 'comparison', 'sources', 'conclusion']));
const bytes = await renderPresentation(presentation);
await assertValidPptx(bytes, { expectedSlideCount: 4, imagesExpected: false });
await mkdir('work', { recursive: true });
await writeFile('work/comparison-sample.pptx', bytes);
await writeFile('work/comparison-sample.json', JSON.stringify(presentation, null, 2));
console.log('Created work/comparison-sample.pptx with 4 validated slides.');
