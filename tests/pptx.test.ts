import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderPresentation } from '../src/renderer/pptx.js';
import { slideFixture } from './regression/fixtures.js';

test('local renderer produces a non-empty PPTX for the supported title layout', async () => {
  const presentation = {
    chatId: 'fixture-chat',
    presentation: { fullTopic: 'Тестовая тема', displayTitle: 'Тестовая тема', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const },
    slides: [slideFixture('title', 1)],
  };
  presentation.slides[0]!.title = 'Тестовая тема';
  const buffer = await renderPresentation(presentation);
  assert.ok(buffer.byteLength > 1000);
  assert.deepEqual(Array.from(buffer.subarray(0, 4)), [0x50, 0x4b, 0x03, 0x04]);
});

test('local renderer rejects layouts not extracted yet', async () => {
  const presentation = {
    chatId: 'fixture-chat',
    presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const },
    slides: [slideFixture('hero', 1)],
  };
  await assert.rejects(() => renderPresentation(presentation), /Layout not implemented.*hero/);
});
