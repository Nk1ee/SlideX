import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderPresentation } from '../src/renderer/pptx.js';
import { validatePptxBinary } from '../src/qc/pptxValidation.js';
import { slideFixture } from './regression/fixtures.js';

test('PPTX validator checks ZIP parts and exact slide count', async () => {
  const title = slideFixture('title', 1);
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [title] };
  const binary = await renderPresentation(presentation);
  const report = await validatePptxBinary(binary, { expectedSlideCount: 1 });
  assert.equal(report.ok, true);
  assert.equal(report.slideCount, 1);
  assert.ok(report.entries.includes('[Content_Types].xml'));
  assert.ok(report.entries.includes('ppt/presentation.xml'));
});

test('PPTX validator reports invalid binary and count mismatch', async () => {
  const invalid = await validatePptxBinary(new Uint8Array([1, 2, 3]));
  assert.equal(invalid.ok, false);
  const title = slideFixture('title', 1);
  const presentation = { chatId: 'fixture-chat', presentation: { fullTopic: 'Тест', displayTitle: 'Тест', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue' as const, language: 'ru' as const }, slides: [title] };
  const binary = await renderPresentation(presentation);
  const mismatch = await validatePptxBinary(binary, { expectedSlideCount: 2 });
  assert.equal(mismatch.ok, false);
  assert.ok(mismatch.issues.some((issue) => issue.includes('Expected 2 slides')));
});
