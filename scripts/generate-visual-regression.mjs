import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertValidPptx } from '../dist/src/qc/pptxValidation.js';
import { slideSchema } from '../dist/src/presentation/schema.js';
import { validatePresentation } from '../dist/src/presentation/validator.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';

const require = createRequire(import.meta.url);
const pptxgen = require('pptxgenjs');
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const assetDir = join(root, 'tests', 'visual-regression', 'assets');
await mkdir(assetDir, { recursive: true });

const visual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
function slide(number, layout, title, extra = {}) {
  return slideSchema.parse({
    number, type: ['title', 'sources', 'conclusion'].includes(layout) ? layout : 'content',
    layout, title, subtitle: '', bullets: [], cards: [], columns: [], comparison: null,
    statistics: null, timeline: [], steps: [], definition: null, quote: null,
    visual, sources: [], ...extra,
  });
}

const slides = [
  slide(1, 'title', 'Проверка качества слайдов'),
  slide(2, 'hero', 'Главная мысль', { subtitle: 'Оформление должно помогать прочитать и понять содержание.' }),
  slide(3, 'definition', 'Как отслеживать качество', { definition: { term: 'Визуальная регрессия', text: 'Повторная проверка того, как выглядит слайд после изменения кода.' } }),
  slide(4, 'sources', 'Источники', { sources: [
    { title: 'Архитектура проекта SlideX', organization: 'SlideX' },
    { title: 'Контракт презентации SlideX', organization: 'SlideX' },
    { title: 'Правила качества PPTX SlideX', organization: 'SlideX' },
  ] }),
  slide(5, 'conclusion', 'Что проверяем', { cards: [
    { title: 'Текст', text: 'Все строки читаются и не выходят за край слайда.' },
    { title: 'Композиция', text: 'Важные элементы не перекрывают друг друга.' },
    { title: 'Содержание', text: 'Выводы и источники остаются видимыми.' },
  ] }),
];

const request = { topic: 'Проверка качества слайдов SlideX', subject: 'Информатик', studentName: 'Ох', group: '4', slideCount: 5, style: 'minimal_light' };
const presentation = validatePresentation({
  chatId: 'synthetic-visual-regression',
  presentation: {
    fullTopic: request.topic, displayTitle: slides[0].title, subject: request.subject,
    studentName: request.studentName, group: request.group, slideCount: request.slideCount,
    style: request.style, language: 'ru',
  },
  slides,
}, request);
const goodPptx = await renderPresentation(presentation);
await assertValidPptx(goodPptx, { expectedSlideCount: slides.length, imagesExpected: false });
await writeFile(join(assetDir, 'good.pptx'), goodPptx);

const cases = [];
for (const current of slides) {
  const id = `good-${String(current.number).padStart(2, '0')}-${current.layout}`;
  const jsonName = `${id}.json`;
  await writeFile(join(assetDir, jsonName), JSON.stringify(current, null, 2) + '\n');
  cases.push({ id, expectedDecision: 'accept', expectedFailedCheck: null,
    layout: current.layout, slide: `assets/${jsonName}`, png: `assets/${id}.png`,
    pptx: 'assets/good.pptx', pptxSlideNumber: current.number });
}

function diagnosticDeck(sourceSlide, defect) {
  const deck = new pptxgen();
  deck.layout = 'LAYOUT_WIDE';
  deck.author = 'SlideX visual regression fixture';
  const page = deck.addSlide();
  page.background = { color: '0A1128' };
  page.addText(sourceSlide.title, { x: 0.65, y: 0.45, w: 12, h: 0.65, color: 'FFFFFF', bold: true, fontFace: 'Arial', fontSize: 28, margin: 0 });
  if (defect === 'overlap') {
    sourceSlide.sources.forEach((source, index) => {
      page.addText(`${index + 1}. ${source.title} — ${source.organization}`, {
        x: 0.85, y: 1.7 + index * 1.05, w: 11.3, h: 0.55,
        color: 'FFFFFF', fontFace: 'Arial', fontSize: 22, margin: 0,
      });
    });
    // Deliberately drawn after the text: reproduces the historical overlay risk.
    page.addShape(deck.ShapeType.rect, { x: 0.7, y: 2.55, w: 12, h: 1.35,
      line: { color: '172D4F' }, fill: { color: '172D4F' } });
  } else {
    sourceSlide.cards.forEach((card, index) => {
      page.addText(`${index + 1}. ${card.title}`, { x: index === 2 ? 11.8 : 0.85,
        y: 1.7 + index * 1.35, w: 4.6, h: 0.5, color: 'FFFFFF',
        fontFace: 'Arial', fontSize: 22, bold: true, margin: 0 });
      page.addText(card.text, { x: index === 2 ? 11.8 : 0.85,
        y: 2.2 + index * 1.35, w: 6.0, h: 0.6, color: 'FFFFFF',
        fontFace: 'Arial', fontSize: 18, margin: 0 });
    });
  }
  return deck;
}

for (const [id, original, defect, failedCheck] of [
  ['bad-overlap-sources', slides[3], 'overlap', 'overlap'],
  ['bad-clipping-conclusion', slides[4], 'clipping', 'clipping'],
]) {
  const current = slideSchema.parse({ ...original, number: 1 });
  const deck = diagnosticDeck(current, defect);
  const binary = new Uint8Array(await deck.write({ outputType: 'nodebuffer' }));
  await assertValidPptx(binary, { expectedSlideCount: 1, imagesExpected: false });
  await writeFile(join(assetDir, `${id}.pptx`), binary);
  await writeFile(join(assetDir, `${id}.json`), JSON.stringify(current, null, 2) + '\n');
  cases.push({ id, expectedDecision: 'reject', expectedFailedCheck: failedCheck,
    layout: current.layout, slide: `assets/${id}.json`, png: `assets/${id}.png`,
    pptx: `assets/${id}.pptx`, pptxSlideNumber: 1 });
}

await writeFile(join(root, 'tests', 'visual-regression', 'manifest.json'), JSON.stringify({
  version: 1,
  note: 'Synthetic layout fixtures; source names refer to project documentation, not external academic citations.',
  cases,
}, null, 2) + '\n');
console.log(`Generated ${cases.length} visual regression cases.`);
