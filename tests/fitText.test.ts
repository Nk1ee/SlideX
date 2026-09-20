import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fitText } from '../src/renderer/fitText.js';

test('fitText keeps preferred size when text fits', () => {
  const result = fitText({ text: 'Короткий текст', widthInches: 7.6, maxHeightInches: 1.5, preferredFontSize: 24, minFontSize: 18 });
  assert.equal(result.fontSize, 24);
  assert.equal(result.overflow, false);
  assert.equal(result.estimatedLines, 1);
});

test('fitText reduces size moderately before rendering', () => {
  const result = fitText({ text: 'Длинный текст '.repeat(8), widthInches: 3, maxHeightInches: 1.2, preferredFontSize: 24, minFontSize: 12 });
  assert.ok(result.fontSize < 24);
  assert.equal(result.overflow, false);
  assert.ok(result.estimatedHeight <= 1.2);
});

test('fitText reports overflow instead of shrinking below minimum', () => {
  const result = fitText({ text: 'Очень длинный текст '.repeat(500), widthInches: 2, maxHeightInches: 0.5, preferredFontSize: 24, minFontSize: 16 });
  assert.equal(result.fontSize, 16);
  assert.equal(result.overflow, true);
  assert.ok(result.estimatedHeight > 0.5);
});

test('fitText counts explicit line breaks and never truncates content', () => {
  const text = 'Первая строка\nВторая строка';
  const result = fitText({ text, widthInches: 8, maxHeightInches: 2, preferredFontSize: 20, minFontSize: 14 });
  assert.equal(result.estimatedLines, 2);
});

test('fitText rejects invalid geometry and font settings', () => {
  assert.throws(() => fitText({ text: 'x', widthInches: 0, maxHeightInches: 1, preferredFontSize: 20, minFontSize: 14 }));
  assert.throws(() => fitText({ text: 'x', widthInches: 1, maxHeightInches: 1, preferredFontSize: 12, minFontSize: 14 }));
});


