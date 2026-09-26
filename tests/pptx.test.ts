import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import JSZip from 'jszip';
import { test } from 'node:test';
import { renderPresentation } from '../src/renderer/pptx.js';
import { slideFixture } from './regression/fixtures.js';
import { validatePptxBinary } from '../src/qc/pptxValidation.js';

test('local renderer produces a non-empty PPTX for title, sources and conclusion layouts', async () => {
  const title = slideFixture('title', 1);
  title.title = 'Тестовая тема';
  const sources = slideFixture('sources', 2);
  sources.title = 'Источники';
  sources.cards = [];
  sources.sources = [{ title: 'AI and Education: Guidance for Policy-Makers', organization: 'UNESCO', year: 2021, url: 'https://www.unesco.org/' }];
  const conclusion = slideFixture('conclusion', 3); conclusion.title = 'Главные выводы'; conclusion.visual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' }; const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тестовая тема', displayTitle: 'Тестовая тема', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 3, style: 'deep_blue' as const, language: 'ru' as const }, slides: [title, sources, conclusion] };
  const buffer = await renderPresentation(presentation);
  assert.ok(buffer.byteLength > 1000);
  assert.deepEqual(Array.from(buffer.subarray(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
});

test('conclusion renderer refuses images and wrong card counts', async () => {
  const conclusion = slideFixture('conclusion', 1); conclusion.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' }; const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [conclusion] }; await assert.rejects(() => renderPresentation(presentation), /Conclusion layout cannot contain an image/);
});

test('conclusion renderer fits three supplied two-line takeaways', async () => {
  const conclusion = slideFixture('conclusion', 1);
  conclusion.title = 'Результат проверки';
  conclusion.cards = [
    { title: 'Модель мозга', text: 'Нейросети имитируют обработку информации биологическими нейронами с помощью математических алгоритмов.' },
    { title: 'Послойная структура', text: 'Сеть состоит из входных, скрытых и выходных слоев, последовательно обрабатывающих информацию.' },
    { title: 'Практическая польза', text: 'Архитектура ИНС позволяет решать сложные задачи классификации, распознавания и анализа данных.' },
  ];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'minimal_light' as const, language: 'ru' as const }, slides: [conclusion] };
  const binary = await renderPresentation(presentation);
  const report = await validatePptxBinary(binary, { expectedSlideCount: 1 });
  assert.equal(report.ok, true, report.issues.join('; '));
});
test('sources renderer refuses cards and empty source lists', async () => {
  const sources = slideFixture('sources', 1);
  sources.cards = [];
  sources.sources = [];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [sources] };
  await assert.rejects(() => renderPresentation(presentation), /Sources layout requires supplied sources/);
});

test('statistics renderer preserves exact values, units and provenance in a valid PPTX', async () => {
  const slide = slideFixture('statistics', 1);
  slide.title = 'Проверяемые показатели';
  slide.statistics = [
    { value: '3.2x', label: 'Коэффициент', description: 'Значение должно остаться строкой с исходной единицей.', source: { title: 'Контрольная запись', organization: 'SlideX', year: 2026, url: 'https://github.com/Nk1ee/SlideX' } },
    { value: '14 pt', label: 'Минимум BODY', description: 'Размер текста не уменьшается ниже заданного порога.', source: { title: 'typography.ts', organization: 'SlideX repository' } },
  ];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'business_slate' as const, language: 'ru' as const }, slides: [slide] };
  const buffer = await renderPresentation(presentation);
  const report = await validatePptxBinary(buffer, { expectedSlideCount: 1, imagesExpected: false });
  assert.equal(report.ok, true);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  const relationships = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
  const notes = await zip.file('ppt/notesSlides/notesSlide1.xml')!.async('string');
  assert.ok(xml.includes('3.2x'));
  assert.ok(xml.includes('14 pt'));
  assert.ok(xml.includes('Контрольная запись'));
  assert.ok(xml.includes('typography.ts'));
  assert.ok(!xml.includes('78%'));
  assert.ok(relationships.includes('https://github.com/Nk1ee/SlideX'));
  assert.ok(notes.includes('https://github.com/Nk1ee/SlideX'));
});

test('title renderer uses the semantic displayTitle without truncating it', async () => {
  const title = slideFixture('title', 1);
  title.title = 'Искусственный интеллект: возможности и риски в современном образовании';
  const displayTitle = 'Искусственный интеллект в образовании: возможности и риски';
  const presentation = {
    chatId: 'fixture-chat',
    presentation: {
      fullTopic: 'Искусственный интеллект: "возможности и риски"\nв современном образовании',
      displayTitle,
      subject: 'Информатика',
      studentName: 'Иван Иванов',
      group: '82',
      slideCount: 1,
      style: 'minimal_graphite' as const,
      language: 'ru' as const,
      educationContext: { educationStage: 'university' as const, course: '3' },
    },
    slides: [title],
  };
  const binary = await renderPresentation(presentation);
  const report = await validatePptxBinary(binary, { expectedSlideCount: 1, imagesExpected: false });
  assert.equal(report.ok, true, report.issues.join('; '));
  const zip = await JSZip.loadAsync(binary);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  assert.ok(xml.includes(displayTitle));
  assert.ok(!xml.includes(title.title));
});
test('title renderer uses trusted school class or higher-education course', async () => {
  const title = slideFixture('title', 1);
  const cases = [
    { group: '8Г', educationContext: { educationStage: 'school' as const, schoolClass: '8Г' }, expected: ['Ученик: Ох', 'Класс 8Г'] },
    { group: 'ИС-21', educationContext: { educationStage: 'college' as const, course: '2' }, expected: ['Студент: Ох', 'Группа ИС-21, курс 2'] },
  ];
  for (const item of cases) {
    const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатик', studentName: 'Ох', group: item.group, slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const, educationContext: item.educationContext }, slides: [title] };
    const buffer = await renderPresentation(presentation);
    const zip = await JSZip.loadAsync(buffer);
    const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    for (const expected of item.expected) assert.ok(xml.includes(expected));
    assert.ok(xml.includes('Информатик'));
  }
});

test('statistics renderer rejects images, missing sources, excessive data and unreadable overflow', async () => {
  const imageSlide = slideFixture('statistics', 1);
  imageSlide.statistics = [{ value: '13', label: 'Layouts', description: 'Поддерживаемые композиции', source: { title: 'schema.ts', organization: 'SlideX' } }];
  imageSlide.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
  const base = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [imageSlide] };
  await assert.rejects(() => renderPresentation(base), /cannot contain an image/);

  const missingSlide = slideFixture('statistics', 1);
  missingSlide.statistics = null;
  await assert.rejects(() => renderPresentation({ ...base, slides: [missingSlide] }), /requires supplied statistics/);

  const missingSourceSlide = slideFixture('statistics', 1);
  missingSourceSlide.statistics = [{ value: '13', label: 'Layouts', description: 'Описание' }];
  await assert.rejects(() => renderPresentation({ ...base, slides: [missingSourceSlide] }), /requires a supplied source/);

  const excessiveSlide = slideFixture('statistics', 1);
  excessiveSlide.statistics = Array.from({ length: 4 }, (_, index) => ({ value: String(index + 1), label: 'Показатель', description: 'Описание', source: { title: `Источник ${index + 1}`, organization: 'SlideX' } }));
  await assert.rejects(() => renderPresentation({ ...base, slides: [excessiveSlide] }), /at most three statistics/);

  const overflowSlide = slideFixture('statistics', 1);
  overflowSlide.statistics = [{ value: '3.2x', label: 'Показатель', description: 'Очень длинное описание показателя '.repeat(120), source: { title: 'Источник', organization: 'SlideX' } }];
  await assert.rejects(() => renderPresentation({ ...base, slides: [overflowSlide] }), /description overflows at readable minimum/);
});

test('chart renderer creates editable column, bar, pie and doughnut charts', async () => {
  const kinds = ['column', 'bar', 'pie', 'doughnut'] as const;
  const slides = kinds.map((kind, index) => {
    const slide = slideFixture('chart', index + 1);
    slide.title = `Диаграмма ${kind}`;
    slide.chart = {
      kind,
      categories: ['A', 'B', 'C'],
      series: [{ name: 'Переданные данные', values: [12, 7, 4] }],
      unit: 'ед.',
      source: { title: 'Synthetic editable chart test', organization: 'SlideX', url: 'https://github.com/Nk1ee/SlideX' },
    };
    return slide;
  });
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 4, style: 'business_slate' as const, language: 'ru' as const }, slides };
  const buffer = await renderPresentation(presentation);
  const report = await validatePptxBinary(buffer, { expectedSlideCount: 4, imagesExpected: false });
  assert.equal(report.ok, true);
  const zip = await JSZip.loadAsync(buffer);
  const chartEntries = Object.keys(zip.files).filter((name) => /^ppt\/charts\/chart\d+\.xml$/.test(name));
  const workbookEntries = Object.keys(zip.files).filter((name) => /^ppt\/embeddings\/Microsoft_Excel_Worksheet\d+\.xlsx$/.test(name));
  assert.equal(chartEntries.length, 4);
  assert.equal(workbookEntries.length, 4);
  const chartXml = await Promise.all(chartEntries.sort().map((name) => zip.file(name)!.async('string')));
  assert.ok(chartXml[0]!.includes('<c:barChart>'));
  assert.ok(chartXml[1]!.includes('<c:barChart>'));
  assert.ok(chartXml[2]!.includes('<c:pieChart>'));
  assert.ok(chartXml[3]!.includes('<c:doughnutChart>'));
  for (const xml of chartXml) {
    assert.ok(xml.includes('Переданные данные'));
    assert.ok(xml.includes('<c:v>12</c:v>'));
    assert.ok(xml.includes('<c:v>7</c:v>'));
    assert.ok(xml.includes('<c:v>4</c:v>'));
  }
});

test('chart renderer rejects images and missing chart data', async () => {
  const imageSlide = slideFixture('chart', 1);
  imageSlide.visual = { needed: true, type: 'diagram', concept: 'x', query_en: 'x', placement: 'right' };
  const base = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [imageSlide] };
  await assert.rejects(() => renderPresentation(base), /cannot contain an image/);
  const missingSlide = slideFixture('chart', 1);
  missingSlide.chart = null;
  await assert.rejects(() => renderPresentation({ ...base, slides: [missingSlide] }), /requires supplied chart data/);
});

test('process renderer preserves ordered supplied steps in a valid PPTX', async () => {
  const slide = slideFixture('process', 1);
  slide.title = 'Проверка презентации';
  slide.steps = [
    { title: 'Проверить контракт', text: 'Сверить metadata и количество слайдов.' },
    { title: 'Оценить содержание', text: 'Проверить факты, цитаты и источники.' },
    { title: 'Собрать PPTX', text: 'Создать файл и проверить ZIP-структуру.' },
    { title: 'Просмотреть результат', text: 'Открыть экспортированные слайды.' },
  ];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'minimal_graphite' as const, language: 'ru' as const }, slides: [slide] };
  const buffer = await renderPresentation(presentation);
  const report = await validatePptxBinary(buffer, { expectedSlideCount: 1, imagesExpected: false });
  assert.equal(report.ok, true);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  for (const step of slide.steps) {
    assert.ok(xml.includes(step.title));
    assert.ok(xml.includes(step.text));
  }
  assert.ok(!xml.includes('2010-е'));
});

test('process renderer rejects images, missing or excessive steps and unreadable overflow', async () => {
  const imageSlide = slideFixture('process', 1);
  imageSlide.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
  const base = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [imageSlide] };
  await assert.rejects(() => renderPresentation(base), /cannot contain an image/);

  const missingSlide = slideFixture('process', 1);
  missingSlide.steps = [];
  await assert.rejects(() => renderPresentation({ ...base, slides: [missingSlide] }), /requires supplied steps/);

  const excessiveSlide = slideFixture('process', 1);
  excessiveSlide.steps = Array.from({ length: 5 }, (_, index) => ({ title: `Шаг ${index + 1}`, text: 'Описание' }));
  await assert.rejects(() => renderPresentation({ ...base, slides: [excessiveSlide] }), /at most four steps/);

  const overflowSlide = slideFixture('process', 1);
  overflowSlide.steps[0]!.text = 'Очень длинное описание действия '.repeat(120);
  await assert.rejects(() => renderPresentation({ ...base, slides: [overflowSlide] }), /step 1 text overflows at readable minimum/);
});

test('timeline renderer preserves dates, titles and text in a valid PPTX', async () => {
  const slide = slideFixture('timeline', 1);
  slide.title = 'График подготовки презентации';
  slide.timeline = [
    { date: '1 октября', title: 'Черновой план', text: 'Утвердить тему и структуру.' },
    { date: '3 октября', title: 'Проверка содержания', text: 'Проверить факты и источники.' },
    { date: '5 октября', title: 'Финальная версия', text: 'Собрать и просмотреть PPTX.' },
  ];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'business_emerald' as const, language: 'ru' as const }, slides: [slide] };
  const buffer = await renderPresentation(presentation);
  const report = await validatePptxBinary(buffer, { expectedSlideCount: 1, imagesExpected: false });
  assert.equal(report.ok, true);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  for (const entry of slide.timeline) {
    assert.ok(xml.includes(entry.date));
    assert.ok(xml.includes(entry.title));
    assert.ok(xml.includes(entry.text));
  }
  assert.ok(!xml.includes('2010-е'));
});

test('timeline renderer rejects images, missing or excessive entries and unreadable overflow', async () => {
  const imageSlide = slideFixture('timeline', 1);
  imageSlide.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
  const base = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [imageSlide] };
  await assert.rejects(() => renderPresentation(base), /cannot contain an image/);

  const missingSlide = slideFixture('timeline', 1);
  missingSlide.timeline = [];
  await assert.rejects(() => renderPresentation({ ...base, slides: [missingSlide] }), /requires supplied dated entries/);

  const excessiveSlide = slideFixture('timeline', 1);
  excessiveSlide.timeline = Array.from({ length: 5 }, (_, index) => ({ date: `День ${index + 1}`, title: 'Этап', text: 'Описание' }));
  await assert.rejects(() => renderPresentation({ ...base, slides: [excessiveSlide] }), /at most four entries/);

  const overflowSlide = slideFixture('timeline', 1);
  overflowSlide.timeline[0]!.text = 'Очень длинное описание события '.repeat(120);
  await assert.rejects(() => renderPresentation({ ...base, slides: [overflowSlide] }), /entry 1 text overflows at readable minimum/);
});

test('comparison renderer preserves both supplied sides in a valid PPTX', async () => {
  const slide = slideFixture('comparison', 1);
  slide.title = 'Форматы учебного обсуждения';
  slide.comparison = {
    left: { title: 'Очное', items: ['Одна аудитория', 'Ответы в реальном времени'] },
    right: { title: 'Асинхронное', items: ['Разное время ответа', 'Сообщения сохраняются'] },
  };
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'dynamic_violet' as const, language: 'ru' as const }, slides: [slide] };
  const buffer = await renderPresentation(presentation);
  const report = await validatePptxBinary(buffer, { expectedSlideCount: 1, imagesExpected: false });
  assert.equal(report.ok, true);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  for (const side of [slide.comparison.left, slide.comparison.right]) {
    assert.ok(xml.includes(side.title));
    for (const item of side.items) assert.ok(xml.includes(item));
  }
  assert.ok(!xml.includes('Традиционный подход'));
});

test('comparison renderer rejects images, missing data and unreadable overflow', async () => {
  const imageSlide = slideFixture('comparison', 1);
  imageSlide.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
  const base = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [imageSlide] };
  await assert.rejects(() => renderPresentation(base), /cannot contain an image/);

  const missingSlide = slideFixture('comparison', 1);
  missingSlide.comparison = null;
  await assert.rejects(() => renderPresentation({ ...base, slides: [missingSlide] }), /requires supplied left and right sides/);

  const overflowSlide = slideFixture('comparison', 1);
  overflowSlide.comparison!.right.items = ['Очень длинный пункт сравнения '.repeat(120)];
  await assert.rejects(() => renderPresentation({ ...base, slides: [overflowSlide] }), /right items overflow at readable minimum/);
});

test('three-cards renderer preserves three supplied cards in a valid PPTX', async () => {
  const slide = slideFixture('three_cards', 1);
  slide.title = 'Критерии качественного объяснения';
  slide.cards = [
    { title: 'Ясность', text: 'Одна основная мысль в каждом смысловом блоке.' },
    { title: 'Основания', text: 'Утверждения связаны с проверяемыми материалами.' },
    { title: 'Вывод', text: 'Финальная мысль следует из представленных аргументов.' },
  ];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'minimal_sand' as const, language: 'ru' as const }, slides: [slide] };
  const buffer = await renderPresentation(presentation);
  const report = await validatePptxBinary(buffer, { expectedSlideCount: 1, imagesExpected: false });
  assert.equal(report.ok, true);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  for (const card of slide.cards) {
    assert.ok(xml.includes(card.title));
    assert.ok(xml.includes(card.text));
  }
  assert.ok(!xml.includes('Вектор 1'));
});

test('three-cards renderer rejects images, wrong card counts and unreadable overflow', async () => {
  const imageSlide = slideFixture('three_cards', 1);
  imageSlide.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
  const imagePresentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [imageSlide] };
  await assert.rejects(() => renderPresentation(imagePresentation), /cannot contain an image/);

  const incompleteSlide = slideFixture('three_cards', 1);
  incompleteSlide.cards = incompleteSlide.cards.slice(0, 2);
  await assert.rejects(() => renderPresentation({ ...imagePresentation, slides: [incompleteSlide] }), /exactly three supplied cards/);

  const overflowSlide = slideFixture('three_cards', 1);
  overflowSlide.cards[1]!.text = 'Очень длинное описание карточки '.repeat(120);
  await assert.rejects(() => renderPresentation({ ...imagePresentation, slides: [overflowSlide] }), /text 2 overflows at readable minimum/);
});

test('two-column renderer preserves both supplied columns in a valid PPTX', async () => {
  const slide = slideFixture('two_column', 1);
  slide.title = 'Возможности и ограничения';
  slide.columns = [
    { title: 'Возможности', items: ['Объяснение сложной темы', 'Обратная связь по черновику'] },
    { title: 'Ограничения', items: ['Проверка фактов', 'Защита персональных данных'] },
  ];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [slide] };
  const buffer = await renderPresentation(presentation);
  const report = await validatePptxBinary(buffer, { expectedSlideCount: 1, imagesExpected: false });
  assert.equal(report.ok, true);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  for (const column of slide.columns) {
    assert.ok(xml.includes(column.title));
    for (const item of column.items) assert.ok(xml.includes(item));
  }
  assert.ok(!xml.includes('ОСНОВНОЙ АСПЕКТ'));
});

test('two-column renderer rejects images, incomplete columns and unreadable overflow', async () => {
  const imageSlide = slideFixture('two_column', 1);
  imageSlide.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
  const imagePresentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [imageSlide] };
  await assert.rejects(() => renderPresentation(imagePresentation), /cannot contain an image/);

  const incompleteSlide = slideFixture('two_column', 1);
  incompleteSlide.columns = [incompleteSlide.columns[0]!];
  const incompletePresentation = { ...imagePresentation, slides: [incompleteSlide] };
  await assert.rejects(() => renderPresentation(incompletePresentation), /exactly two supplied columns/);

  const overflowSlide = slideFixture('two_column', 1);
  overflowSlide.columns[0]!.items = ['Очень длинный учебный пункт '.repeat(120)];
  const overflowPresentation = { ...imagePresentation, slides: [overflowSlide] };
  await assert.rejects(() => renderPresentation(overflowPresentation), /content 1 overflows at readable minimum/);
});



test('definition renderer keeps term and explanation separate', async () => {
  const definition = slideFixture('definition', 1);
  definition.title = 'Базовый термин';
  definition.visual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [definition] };
  const buffer = await renderPresentation(presentation);
  assert.ok(buffer.byteLength > 1000);
});

test('definition renderer refuses missing definition and images', async () => {
  const definition = slideFixture('definition', 1);
  definition.definition = null;
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [definition] };
  await assert.rejects(() => renderPresentation(presentation), /Definition layout requires supplied definition data/);
});

test('hero renderer uses supplied subtitle as thesis', async () => {
  const hero = slideFixture('hero', 1);
  hero.title = 'Постановка проблемы';
  hero.subtitle = 'Синтетический тезис для проверки композиции';
  hero.visual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [hero] };
  const buffer = await renderPresentation(presentation);
  assert.ok(buffer.byteLength > 1000);
});

test('hero renderer refuses missing thesis and unported images', async () => {
  const hero = slideFixture('hero', 1);
  hero.subtitle = '';
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [hero] };
  await assert.rejects(() => renderPresentation(presentation), /Hero layout requires supplied subtitle thesis/);
});



test('quote renderer keeps supplied quote and attribution', async () => {
  const quote = slideFixture('quote', 1);
  quote.title = 'Определение искусственного интеллекта';
  quote.quote = { text: 'Цитата для проверки сохранения содержания.', author: 'Автор исследования', source: { title: 'Публикация', organization: 'Университет', year: 2024 } };
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [quote] };
  const buffer = await renderPresentation(presentation);
  assert.ok(buffer.byteLength > 1000);
});

test('quote renderer refuses missing quote and images', async () => {
  const quote = slideFixture('quote', 1);
  quote.quote = null;
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [quote] };
  await assert.rejects(() => renderPresentation(presentation), /Quote layout requires supplied quote data/);
});

test('image_text renderer embeds resolved image bytes for each placement', async () => {
  const image = { provider: 'wikimedia', providerId: 'image-1', author: 'Fixture author', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Fixture.png', imageUrl: 'https://example.test/image-1.png', mimeType: 'image/png', width: 1, height: 1, altText: 'student AI assistant classroom', query: 'student AI assistant classroom', concept: 'student using an AI assistant in a classroom', bytes: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') };
  for (const placement of ['left', 'right', 'full', 'background', 'supporting'] as const) {
    const slide = slideFixture('image_text', 1);
    slide.visual = { needed: true, type: 'photo', concept: 'student using an AI assistant in a classroom', query_en: 'student AI assistant classroom', placement };
    slide.bullets = ['AI-помощник помогает разобрать учебный материал'];
    const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [slide] };
    const buffer = await renderPresentation(presentation, { imageResolver: async () => image });
    const report = await validatePptxBinary(buffer, { expectedSlideCount: 1, imagesExpected: true });
    assert.equal(report.ok, true, `placement ${placement} should produce a valid PPTX`);
  }
});

test('image_text renderer refuses missing resolver or image bytes', async () => {
  const slide = slideFixture('image_text', 1);
  slide.visual = { needed: true, type: 'photo', concept: 'student using an AI assistant in a classroom', query_en: 'student AI assistant classroom', placement: 'right' };
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [slide] };
  await assert.rejects(() => renderPresentation(presentation), /imageResolver/);
  await assert.rejects(() => renderPresentation(presentation, { imageResolver: async () => null }), /resolved relevant image/);
});

test('sources renderer fits three real image references with visible clickable URLs', async () => {
  const sources = slideFixture('sources', 1);
  sources.title = 'Источники изображений';
  sources.cards = [];
  sources.sources = [
    { title: 'Фото учебной аудитории', author: 'Photographer One', url: 'https://unsplash.com/photos/classroom-example' },
    { title: 'Схема нейронной сети', organization: 'Wikimedia Commons', url: 'https://commons.wikimedia.org/wiki/File:Simplified_neural_network_model_example.png' },
    { title: 'Фото книжных стеллажей', author: 'Photographer Two', url: 'https://unsplash.com/photos/library-example' },
  ];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [sources] };
  const buffer = await renderPresentation(presentation);
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  const links = await zip.file('ppt/slides/_rels/slide1.xml.rels')!.async('string');
  for (const source of sources.sources) {
    assert.ok(xml.includes(source.title));
    assert.ok(xml.includes(source.url!));
    assert.ok(links.includes(source.url!));
  }
});

test('diagram renderer keeps the full diagram on a functional white background', async () => {
  const image = { provider: 'wikimedia', providerId: 'diagram-1', author: 'Diagram author', license: 'Public domain', sourceUrl: 'https://commons.wikimedia.org/wiki/File:Diagram.svg', imageUrl: 'https://thumb.wikimedia.org/diagram.png', mimeType: 'image/png', width: 1600, height: 1200, altText: 'neural network diagram', query: 'neural network diagram', concept: 'neural network diagram', bytes: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64') };
  const slide = slideFixture('image_text', 1);
  slide.visual = { needed: true, type: 'diagram', concept: 'neural network diagram', query_en: 'neural network diagram', placement: 'left' };
  slide.bullets = ['Узлы и связи между слоями'];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [slide] };
  const buffer = await renderPresentation(presentation, { imageResolver: async () => image });
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('ppt/slides/slide1.xml')!.async('string');
  const notes = await zip.file('ppt/notesSlides/notesSlide1.xml')!.async('string');
  assert.ok(xml.includes('FFFFFF'));
  assert.ok(!xml.includes('<a:srcRect'));
  assert.ok(notes.includes('без кадрирования'));
});
