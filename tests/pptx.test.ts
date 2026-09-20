import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderPresentation } from '../src/renderer/pptx.js';
import { slideFixture } from './regression/fixtures.js';

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
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [slideFixture('image_text', 1)] };
  await assert.rejects(() => renderPresentation(presentation), /Layout not implemented.*image_text/);
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


