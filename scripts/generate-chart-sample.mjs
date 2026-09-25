import { mkdir, writeFile } from 'node:fs/promises';
import { assertContentQuality } from '../dist/src/qc/contentValidation.js';
import { assertLayoutPlan } from '../dist/src/qc/layoutValidation.js';
import { assertValidPptx } from '../dist/src/qc/pptxValidation.js';
import { validatePresentation } from '../dist/src/presentation/validator.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';

const noVisual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
const empty = { subtitle: '', bullets: [], cards: [], columns: [], comparison: null, statistics: null, chart: null, timeline: [], steps: [], definition: null, quote: null, sources: [] };
const source = { title: 'Synthetic chart data for renderer verification', organization: 'SlideX test harness', url: 'https://github.com/Nk1ee/SlideX' };
const request = { topic: 'Редактируемые диаграммы SlideX', subject: 'Информатика', studentName: 'Ох', group: '4', slideCount: 6, style: 'business_slate' };
const chartSlide = (number, kind, title, categories, values, unit, repetitionReason) => ({
  ...empty,
  number,
  type: 'content',
  layout: 'chart',
  title,
  chart: { kind, categories, series: [{ name: 'Демонстрационные данные', values }], unit, source },
  visual: noVisual,
  ...(repetitionReason ? { repetitionReason } : {}),
});
const raw = {
  chatId: 'chart-sample',
  presentation: { fullTopic: request.topic, displayTitle: request.topic, subject: request.subject, studentName: request.studentName, group: request.group, slideCount: request.slideCount, style: request.style, language: 'ru' },
  slides: [
    { ...empty, number: 1, type: 'title', layout: 'title', title: request.topic, visual: noVisual },
    chartSlide(2, 'column', 'Вертикальная столбчатая диаграмма', ['I этап', 'II этап', 'III этап'], [18, 27, 41], 'ед.', undefined),
    chartSlide(3, 'bar', 'Горизонтальная столбчатая диаграмма', ['Группа A', 'Группа B', 'Группа C'], [9, 14, 20], 'ед.', undefined),
    chartSlide(4, 'pie', 'Круговая диаграмма', ['Раздел A', 'Раздел B', 'Раздел C'], [45, 35, 20], 'условных единиц', 'Визуальный тест четырёх поддерживаемых видов диаграмм'),
    chartSlide(5, 'doughnut', 'Кольцевая диаграмма', ['Выполнено', 'Осталось'], [72, 28], 'условных единиц', 'Визуальный тест четырёх поддерживаемых видов диаграмм'),
    { ...empty, number: 6, type: 'sources', layout: 'sources', title: 'Источник тестовых данных', sources: [source], visual: noVisual },
  ],
};

const presentation = validatePresentation(raw, request);
assertContentQuality(presentation);
assertLayoutPlan(presentation, new Set(['title', 'chart', 'sources']));
const bytes = await renderPresentation(presentation);
await assertValidPptx(bytes, { expectedSlideCount: 6, imagesExpected: false });
await mkdir('work', { recursive: true });
await writeFile('work/chart-sample.pptx', bytes);
await writeFile('work/chart-sample.json', JSON.stringify(presentation, null, 2));
console.log('Created work/chart-sample.pptx with four editable chart types.');
