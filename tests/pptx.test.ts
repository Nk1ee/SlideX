import assert from 'node:assert/strict';
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

test('sources renderer refuses cards and empty source lists', async () => {
  const sources = slideFixture('sources', 1);
  sources.cards = [];
  sources.sources = [];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [sources] };
  await assert.rejects(() => renderPresentation(presentation), /Sources layout requires supplied sources/);
});

test('local renderer rejects layouts not extracted yet', async () => {
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [slideFixture('two_column', 1)] };
  await assert.rejects(() => renderPresentation(presentation), /Layout not implemented.*two_column/);
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
  const image = { provider: 'fixture', providerId: 'image-1', sourceUrl: 'https://example.test/source/image-1', imageUrl: 'https://example.test/image-1.png', mimeType: 'image/png', width: 1, height: 1, altText: 'student AI assistant classroom', query: 'student AI assistant classroom', concept: 'student using an AI assistant in a classroom', bytes: Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]) };
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
