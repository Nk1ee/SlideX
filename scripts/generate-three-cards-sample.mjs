import { mkdir, writeFile } from 'node:fs/promises';
import { assertContentQuality } from '../dist/src/qc/contentValidation.js';
import { assertLayoutPlan } from '../dist/src/qc/layoutValidation.js';
import { assertValidPptx } from '../dist/src/qc/pptxValidation.js';
import { validatePresentation } from '../dist/src/presentation/validator.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';

const noVisual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
const empty = { subtitle: '', bullets: [], cards: [], columns: [], comparison: null, statistics: null, chart: null, timeline: [], steps: [], definition: null, quote: null, sources: [] };
const request = {
  topic: 'Три свойства качественного учебного объяснения',
  subject: 'Информатика',
  studentName: 'Ох',
  group: '4',
  slideCount: 4,
  style: 'minimal_sand',
};
const raw = {
  chatId: 'three-cards-sample',
  presentation: {
    fullTopic: request.topic,
    displayTitle: 'Качественное учебное объяснение',
    subject: request.subject,
    studentName: request.studentName,
    group: request.group,
    slideCount: request.slideCount,
    style: request.style,
    language: 'ru',
  },
  slides: [
    { ...empty, number: 1, type: 'title', layout: 'title', title: 'Качественное учебное объяснение', visual: noVisual },
    {
      ...empty,
      number: 2,
      type: 'content',
      layout: 'three_cards',
      title: 'Три свойства понятного ответа',
      cards: [
        { title: 'Ясная структура', text: 'Одна основная мысль в каждом смысловом блоке.' },
        { title: 'Проверяемые основания', text: 'Утверждения связаны с материалами, которые можно проверить.' },
        { title: 'Самостоятельный вывод', text: 'Финальная мысль следует из представленных аргументов.' },
      ],
      visual: noVisual,
    },
    {
      ...empty,
      number: 3,
      type: 'sources',
      layout: 'sources',
      title: 'О тестовом материале',
      sources: [{ title: 'Синтетический пример для проверки layout three_cards', organization: 'SlideX' }],
      visual: noVisual,
    },
    {
      ...empty,
      number: 4,
      type: 'conclusion',
      layout: 'conclusion',
      title: 'Что проверяет этот образец',
      cards: [
        { title: 'Три блока', text: 'Каждая карточка сохраняет собственные title и text.' },
        { title: 'Единая типографика', text: 'Размеры текста берутся из общих ролей SlideX.' },
        { title: 'Без подстановок', text: 'Renderer не создаёт содержание при неполном payload.' },
      ],
      visual: noVisual,
    },
  ],
};

const presentation = validatePresentation(raw, request);
assertContentQuality(presentation);
assertLayoutPlan(presentation, new Set(['title', 'three_cards', 'sources', 'conclusion']));
const bytes = await renderPresentation(presentation);
await assertValidPptx(bytes, { expectedSlideCount: 4, imagesExpected: false });
await mkdir('work', { recursive: true });
await writeFile('work/three-cards-sample.pptx', bytes);
await writeFile('work/three-cards-sample.json', JSON.stringify(presentation, null, 2));
console.log('Created work/three-cards-sample.pptx with 4 validated slides.');
