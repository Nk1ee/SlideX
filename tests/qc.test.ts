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

test('content gate reports oversized two-column content without changing it', () => {
  const presentation = presentationFixture(requests[0]!);
  const slide = presentation.slides[1]!;
  slide.layout = 'two_column';
  slide.columns[0]!.items = ['Длинный пункт '.repeat(30)];
  const before = slide.columns[0]!.items[0];
  const report = validateContentQuality(presentation);
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.code === 'column_item_too_long'));
  assert.equal(slide.columns[0]!.items[0], before);
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

test('layout gate rejects an image request on two-column before rendering', () => {
  const presentation = presentationFixture(requests[0]!);
  presentation.slides[1]!.layout = 'two_column';
  presentation.slides[1]!.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
  const report = validateLayoutPlan(presentation, new Set(['title', 'two_column', 'process', 'conclusion']));
  assert.equal(report.ok, false);
  assert.ok(report.issues.some((item) => item.code === 'two_column_has_image'));
});

test('quality gates reject oversized card titles and images on three-cards', () => {
  const presentation = presentationFixture(requests[0]!);
  const slide = presentation.slides[1]!;
  slide.layout = 'three_cards';
  slide.cards[0]!.title = 'Слишком длинный заголовок карточки '.repeat(5);
  slide.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
  const contentReport = validateContentQuality(presentation);
  const layoutReport = validateLayoutPlan(presentation, new Set(['title', 'three_cards', 'process', 'conclusion']));
  assert.ok(contentReport.issues.some((item) => item.code === 'card_title_too_long'));
  assert.ok(layoutReport.issues.some((item) => item.code === 'three_cards_has_image'));
});

test('quality gates reject oversized comparison content and images', () => {
  const presentation = presentationFixture(requests[0]!);
  const slide = presentation.slides[1]!;
  slide.layout = 'comparison';
  slide.comparison!.right.items = ['Слишком длинный пункт сравнения '.repeat(20)];
  slide.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
  const contentReport = validateContentQuality(presentation);
  const layoutReport = validateLayoutPlan(presentation, new Set(['title', 'comparison', 'process', 'conclusion']));
  assert.ok(contentReport.issues.some((item) => item.code === 'comparison_item_too_long'));
  assert.ok(layoutReport.issues.some((item) => item.code === 'comparison_has_image'));
});

