import { mkdir, writeFile } from 'node:fs/promises';
import { assertContentQuality } from '../dist/src/qc/contentValidation.js';
import { assertLayoutPlan } from '../dist/src/qc/layoutValidation.js';
import { assertValidPptx } from '../dist/src/qc/pptxValidation.js';
import { validatePresentation } from '../dist/src/presentation/validator.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';

const noVisual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
const empty = { subtitle: '', bullets: [], cards: [], columns: [], comparison: null, statistics: null, chart: null, timeline: [], steps: [], definition: null, quote: null, sources: [] };
const request = {
  topic: 'Процесс проверки учебной презентации',
  subject: 'Информатика',
  studentName: 'Ох',
  group: '4',
  slideCount: 4,
  style: 'minimal_graphite',
};
const raw = {
  chatId: 'process-sample',
  presentation: {
    fullTopic: request.topic,
    displayTitle: 'Проверка учебной презентации',
    subject: request.subject,
    studentName: request.studentName,
    group: request.group,
    slideCount: request.slideCount,
    style: request.style,
    language: 'ru',
  },
  slides: [
    { ...empty, number: 1, type: 'title', layout: 'title', title: 'Проверка учебной презентации', visual: noVisual },
    {
      ...empty,
      number: 2,
      type: 'content',
      layout: 'process',
      title: 'От контракта к готовому файлу',
      steps: [
        { title: 'Проверить контракт', text: 'Сверить metadata и точное количество слайдов.' },
        { title: 'Оценить содержание', text: 'Проверить формулировки, факты, цитаты и источники.' },
        { title: 'Собрать PPTX', text: 'Создать файл и проверить его ZIP-структуру.' },
        { title: 'Просмотреть результат', text: 'Открыть экспортированные слайды и проверить композицию.' },
      ],
      visual: noVisual,
    },
    {
      ...empty,
      number: 3,
      type: 'sources',
      layout: 'sources',
      title: 'О тестовом материале',
      sources: [{ title: 'Синтетический пример для проверки layout process', organization: 'SlideX' }],
      visual: noVisual,
    },
    {
      ...empty,
      number: 4,
      type: 'conclusion',
      layout: 'conclusion',
      title: 'Что проверяет этот образец',
      cards: [
        { title: 'Порядок действий', text: 'Номера и направляющая показывают последовательность.' },
        { title: 'Динамическая высота', text: 'Каждый следующий шаг начинается после измеренного блока.' },
        { title: 'Без дат', text: 'Process остаётся визуально отличимым от timeline.' },
      ],
      visual: noVisual,
    },
  ],
};

const presentation = validatePresentation(raw, request);
assertContentQuality(presentation);
assertLayoutPlan(presentation, new Set(['title', 'process', 'sources', 'conclusion']));
const bytes = await renderPresentation(presentation);
await assertValidPptx(bytes, { expectedSlideCount: 4, imagesExpected: false });
await mkdir('work', { recursive: true });
await writeFile('work/process-sample.pptx', bytes);
await writeFile('work/process-sample.json', JSON.stringify(presentation, null, 2));
console.log('Created work/process-sample.pptx with 4 validated slides.');
