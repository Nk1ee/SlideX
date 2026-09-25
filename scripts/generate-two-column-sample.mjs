import { mkdir, writeFile } from 'node:fs/promises';
import { assertContentQuality } from '../dist/src/qc/contentValidation.js';
import { assertLayoutPlan } from '../dist/src/qc/layoutValidation.js';
import { assertValidPptx } from '../dist/src/qc/pptxValidation.js';
import { validatePresentation } from '../dist/src/presentation/validator.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';

const noVisual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
const empty = { subtitle: '', bullets: [], cards: [], columns: [], comparison: null, statistics: null, chart: null, timeline: [], steps: [], definition: null, quote: null, sources: [] };
const request = {
  topic: 'Искусственный интеллект в учебном процессе: возможности и ограничения',
  subject: 'Информатик',
  studentName: 'Ох',
  group: '4',
  slideCount: 4,
  style: 'deep_blue',
};
const raw = {
  chatId: 'two-column-sample',
  presentation: {
    fullTopic: request.topic,
    displayTitle: 'ИИ в учебном процессе',
    subject: request.subject,
    studentName: request.studentName,
    group: request.group,
    slideCount: request.slideCount,
    style: request.style,
    language: 'ru',
  },
  slides: [
    { ...empty, number: 1, type: 'title', layout: 'title', title: 'ИИ в учебном процессе', visual: noVisual },
    {
      ...empty,
      number: 2,
      type: 'content',
      layout: 'two_column',
      title: 'Возможности и зоны контроля',
      columns: [
        { title: 'Что помогает студенту', items: ['Объяснение сложной темы разными словами', 'Тренировка на дополнительных заданиях', 'Быстрая обратная связь по черновику'] },
        { title: 'Что требует контроля', items: ['Проверка фактов по надёжным источникам', 'Самостоятельное объяснение полученного ответа', 'Защита персональных данных'] },
      ],
      visual: noVisual,
    },
    {
      ...empty,
      number: 3,
      type: 'sources',
      layout: 'sources',
      title: 'О тестовом материале',
      sources: [{ title: 'Синтетический пример для проверки layout two_column', organization: 'SlideX' }],
      visual: noVisual,
    },
    {
      ...empty,
      number: 4,
      type: 'conclusion',
      layout: 'conclusion',
      title: 'Что проверяет этот образец',
      cards: [
        { title: 'Две колонки', text: 'Обе стороны используют отдельные заголовки и пункты.' },
        { title: 'Читаемый текст', text: 'Размеры берутся из единой типографической системы.' },
        { title: 'Строгий контракт', text: 'Renderer не создаёт fallback-контент и не добавляет изображение.' },
      ],
      visual: noVisual,
    },
  ],
};

const presentation = validatePresentation(raw, request);
assertContentQuality(presentation);
assertLayoutPlan(presentation, new Set(['title', 'two_column', 'sources', 'conclusion']));
const bytes = await renderPresentation(presentation);
await assertValidPptx(bytes, { expectedSlideCount: 4, imagesExpected: false });
await mkdir('work', { recursive: true });
await writeFile('work/two-column-sample.pptx', bytes);
await writeFile('work/two-column-sample.json', JSON.stringify(presentation, null, 2));
console.log('Created work/two-column-sample.pptx with 4 validated slides.');
