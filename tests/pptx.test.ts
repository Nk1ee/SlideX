import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderPresentation } from '../src/renderer/pptx.js';
import { slideFixture } from './regression/fixtures.js';

test('local renderer produces a non-empty PPTX for title and sources layouts', async () => {
  const title = slideFixture('title', 1);
  title.title = 'Тестовая тема';
  const sources = slideFixture('sources', 2);
  sources.title = 'Источники';
  sources.cards = [];
  sources.sources = [{ title: 'AI and Education: Guidance for Policy-Makers', organization: 'UNESCO', year: 2021, url: 'https://www.unesco.org/' }];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тестовая тема', displayTitle: 'Тестовая тема', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 2, style: 'deep_blue' as const, language: 'ru' as const }, slides: [title, sources] };
  const buffer = await renderPresentation(presentation);
  assert.ok(buffer.byteLength > 1000);
  assert.deepEqual(Array.from(buffer.subarray(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
});

test('sources renderer refuses cards and empty source lists', async () => {
  const sources = slideFixture('sources', 1);
  sources.cards = [];
  sources.sources = [];
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [sources] };
  await assert.rejects(() => renderPresentation(presentation), /Sources layout requires supplied sources/);
});

test('local renderer rejects layouts not extracted yet', async () => {
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [slideFixture('hero', 1)] };
  await assert.rejects(() => renderPresentation(presentation), /Layout not implemented.*hero/);
});

