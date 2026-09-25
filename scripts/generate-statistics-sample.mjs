import { mkdir, writeFile } from 'node:fs/promises';
import { assertContentQuality } from '../dist/src/qc/contentValidation.js';
import { assertLayoutPlan } from '../dist/src/qc/layoutValidation.js';
import { assertValidPptx } from '../dist/src/qc/pptxValidation.js';
import { validatePresentation } from '../dist/src/presentation/validator.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';

const noVisual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
const empty = { subtitle: '', bullets: [], cards: [], columns: [], comparison: null, statistics: null, chart: null, timeline: [], steps: [], definition: null, quote: null, sources: [] };
const repositoryBase = 'https://github.com/Nk1ee/SlideX/blob/main';
const sources = [
  { title: 'src/presentation/schema.ts', organization: 'SlideX repository', url: `${repositoryBase}/src/presentation/schema.ts` },
  { title: 'src/qc/contentValidation.ts', organization: 'SlideX repository', url: `${repositoryBase}/src/qc/contentValidation.ts` },
  { title: 'src/renderer/typography.ts', organization: 'SlideX repository', url: `${repositoryBase}/src/renderer/typography.ts` },
];
const request = {
  topic: 'Контрольные показатели SlideX',
  subject: 'Информатика',
  studentName: 'Ох',
  group: '4',
  slideCount: 4,
  style: 'business_slate',
};
const raw = {
  chatId: 'statistics-sample',
  presentation: {
    fullTopic: request.topic,
    displayTitle: request.topic,
    subject: request.subject,
    studentName: request.studentName,
    group: request.group,
    slideCount: request.slideCount,
    style: request.style,
    language: 'ru',
  },
  slides: [
    { ...empty, number: 1, type: 'title', layout: 'title', title: request.topic, visual: noVisual },
    {
      ...empty,
      number: 2,
      type: 'content',
      layout: 'statistics',
      title: 'Проверяемые ограничения renderer',
      statistics: [
        { value: '13', label: 'Layouts в контракте', description: 'Schema перечисляет тринадцать поддерживаемых типов композиции.', source: sources[0] },
        { value: '3', label: 'Показателя на слайде', description: 'Quality gate ограничивает слайд тремя читаемыми показателями.', source: sources[1] },
        { value: '14 pt', label: 'Минимальный BODY', description: 'Типографическая политика не уменьшает основной текст ниже 14 pt.', source: sources[2] },
      ],
      visual: noVisual,
    },
    { ...empty, number: 3, type: 'sources', layout: 'sources', title: 'Источники показателей', sources, visual: noVisual },
    {
      ...empty,
      number: 4,
      type: 'conclusion',
      layout: 'conclusion',
      title: 'Что гарантирует statistics layout',
      cards: [
        { title: 'Точная строка', text: 'Значение и единица переходят в PPTX без преобразования.' },
        { title: 'Явный источник', text: 'Каждый показатель связан с переданным источником.' },
        { title: 'Читаемый предел', text: 'Слишком большой объём отклоняется до создания файла.' },
      ],
      visual: noVisual,
    },
  ],
};

const presentation = validatePresentation(raw, request);
assertContentQuality(presentation);
assertLayoutPlan(presentation, new Set(['title', 'statistics', 'sources', 'conclusion']));
const bytes = await renderPresentation(presentation);
await assertValidPptx(bytes, { expectedSlideCount: 4, imagesExpected: false });
await mkdir('work', { recursive: true });
await writeFile('work/statistics-sample.pptx', bytes);
await writeFile('work/statistics-sample.json', JSON.stringify(presentation, null, 2));
console.log('Created work/statistics-sample.pptx with 4 validated slides.');
