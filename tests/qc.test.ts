import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateContentQuality } from '../src/qc/contentValidation.js';
import { validateLayoutPlan } from '../src/qc/layoutValidation.js';
import { presentationFixture, requests } from './regression/fixtures.js';

test('content gate reports long AI text without changing it', () => {
  const presentation = presentationFixture(requests[0]!);
  presentation.slides[1]!.title = 'Очень длинный заголовок '.repeat(20);
  const before = presentation.slides[1]!.title;
  const report = validateContentQuality(presentation);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.code === 'slide_title_too_long'));
  assert.equal(presentation.slides[1]!.title, before);
});

test('content gate does not invent statistics or sources', () => {
  const presentation = presentationFixture(requests[0]!);
  presentation.slides[1]!.layout = 'statistics';
  presentation.slides[1]!.statistics = [{ value: '3.2x', label: 'Показатель', description: 'Описание' }];
  const report = validateContentQuality(presentation);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.code === 'statistic_without_source'));
  assert.equal(presentation.slides[1]!.statistics[0]!.value, '3.2x');
});

test('layout gate separates plan errors from content errors', () => {
  const presentation = presentationFixture(requests[0]!);
  presentation.slides[0]!.layout = 'hero';
  const report = validateLayoutPlan(presentation, new Set(['title', 'hero', 'definition', 'conclusion']));
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.code === 'first_slide_not_title'));
  assert.ok(report.issues.some((item) => item.code === 'layout_not_implemented'));
});

test('layout gate rejects image on conclusion and missing implementation', () => {
  const presentation = presentationFixture(requests[0]!);
  presentation.slides.at(-1)!.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
  const report = validateLayoutPlan(presentation, new Set(['title', 'process', 'conclusion']));
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.code === 'final_layout_has_image'));
  assert.ok(report.issues.some((item) => item.code === 'layout_not_implemented'));
});

