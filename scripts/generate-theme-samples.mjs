import { mkdir, writeFile } from 'node:fs/promises';
import { PRESENTATION_THEME_OPTIONS } from '../dist/src/presentation/themes.js';
import { presentationSchema } from '../dist/src/presentation/schema.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';
import { validatePptxBinary } from '../dist/src/qc/pptxValidation.js';

const noVisual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
const source = { title: 'SlideX: визуальные темы презентации', organization: 'SlideX' };
const empty = {
  subtitle: '', bullets: [], cards: [], columns: [], comparison: null,
  statistics: null, timeline: [], steps: [], definition: null, quote: null,
  visual: noVisual, sources: [],
};
const slides = [
  {
    ...empty, number: 1, type: 'title', layout: 'title',
    title: 'Искусственный интеллект в образовании',
  },
  {
    ...empty, number: 2, type: 'sources', layout: 'sources',
    title: 'Источник оформления',
    sources: [source],
  },
  {
    ...empty, number: 3, type: 'conclusion', layout: 'conclusion',
    title: 'Три свойства темы',
    cards: [
      { title: 'Единая палитра', text: 'Цвета согласованы во всей презентации.' },
      { title: 'Читаемый текст', text: 'Заголовки и основной текст различаются по роли.' },
      { title: 'Готовность к росту', text: 'Новые варианты добавляются через каталог тем.' },
    ],
  },
];

await mkdir('work/theme-samples', { recursive: true });
for (const theme of PRESENTATION_THEME_OPTIONS) {
  const input = presentationSchema.parse({
    chatId: 'theme-sample',
    presentation: {
      fullTopic: 'Искусственный интеллект в образовании',
      displayTitle: 'Искусственный интеллект в образовании',
      subject: 'Информатика',
      studentName: 'Иван Иванов',
      group: '24138',
      slideCount: slides.length,
      style: theme.id,
      language: 'ru',
    },
    slides,
  });
  const pptx = await renderPresentation(input);
  const report = await validatePptxBinary(pptx, { expectedSlideCount: slides.length });
  if (!report.ok) throw new Error(`${theme.id}: ${report.issues.join('; ')}`);
  const path = `work/theme-samples/${theme.id}.pptx`;
  await writeFile(path, pptx);
  console.log(`${path}: ${report.slideCount} slides, ${pptx.byteLength} bytes`);
}
