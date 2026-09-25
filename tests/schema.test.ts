import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chartSchema, layoutSchema, presentationSchema, slideSchema, sourceSchema } from '../src/presentation/schema.js';
import { presentationFixture, requests, slideFixture } from './regression/fixtures.js';

test('all target layouts have explicit required content', () => {
  for (const layout of layoutSchema.options) {
    const slide = slideFixture(layout);
    if (layout === 'statistics') slide.statistics = [{ value: '3.2x', label: 'Fixture ratio', description: 'Synthetic test value', source: { title: 'Synthetic test provenance', organization: 'Test harness' } }];
    if (layout === 'quote') slide.quote = { text: 'Synthetic quote for parser testing', author: 'Test harness' };
    if (layout === 'sources') slide.sources = [{ title: 'Synthetic test provenance', organization: 'Test harness' }];
    assert.deepEqual(slideSchema.parse(slide), slide);
  }
});

test('unknown layouts, aliases, and missing fields rejected', () => {
  const slide = slideFixture('three_cards');
  assert.equal(slideSchema.safeParse({ ...slide, layout: 'unknown' }).success, false);
  assert.equal(slideSchema.safeParse({ ...slide, leftPoints: ['x'] }).success, false);
  assert.equal(slideSchema.safeParse({ ...slide, cards: [{ title: 'a', description: 'b' }] }).success, false);
  for (const key of Object.keys(slide)) {
    const candidate: Record<string, unknown> = { ...slide };
    delete candidate[key];
    assert.equal(slideSchema.safeParse(candidate).success, false, key);
  }
});

test('mandatory layout data never fabricated', () => {
  for (const [layout, field, empty] of [
    ['quote', 'quote', null], ['statistics', 'statistics', null], ['sources', 'sources', []],
    ['chart', 'chart', null],
    ['timeline', 'timeline', []], ['comparison', 'comparison', null], ['process', 'steps', []],
    ['definition', 'definition', null], ['three_cards', 'cards', []], ['two_column', 'columns', []],
    ['conclusion', 'cards', []], ['hero', 'subtitle', ''], ['image_text', 'bullets', []],
  ] as const) {
    const candidate = { ...slideFixture(layout), [field]: empty };
    const before = structuredClone(candidate);
    assert.equal(slideSchema.safeParse(candidate).success, false, layout);
    assert.deepEqual(candidate, before);
  }
});

test('chart contract preserves supplied data and rejects inconsistent series', () => {
  const chart = {
    kind: 'doughnut' as const,
    categories: ['Проверено', 'Требует проверки'],
    series: [{ name: 'Слайды', values: [7, 3] }],
    unit: 'слайдов',
    source: { title: 'Отчёт проверки', organization: 'SlideX' },
  };
  assert.deepEqual(chartSchema.parse(chart), chart);
  assert.equal(chartSchema.safeParse({ ...chart, series: [{ name: 'Слайды', values: [7] }] }).success, false);
  assert.equal(chartSchema.safeParse({ ...chart, series: [{ name: 'A', values: [7, 3] }, { name: 'B', values: [2, 8] }] }).success, false);
  assert.equal(chartSchema.safeParse({ ...chart, series: [{ name: 'Слайды', values: [-1, 3] }] }).success, false);
  assert.equal(chartSchema.safeParse({ ...chart, series: [{ name: 'Слайды', values: [0, 0] }] }).success, false);
});

test('statistics units preserved and missing provenance rejected', () => {
  const slide = slideFixture('statistics');
  slide.statistics = [{ value: '3.2x', label: 'Synthetic value', description: 'Test only' }];
  assert.equal(slideSchema.safeParse(slide).success, false);
  slide.statistics[0]!.source = { title: 'Synthetic provenance', organization: 'Test harness' };
  assert.equal(slideSchema.parse(slide).statistics?.[0]?.value, '3.2x');
});

test('visual plan and quote survive parsing intact', () => {
  const slide = slideFixture('quote');
  slide.quote = { text: 'Synthetic quote', author: 'Test harness', source: { title: 'Test record', organization: 'Test harness' } };
  slide.visual = { needed: true, type: 'photo', concept: 'Student using an AI assistant', query_en: 'student AI assistant classroom', placement: 'left' };
  assert.deepEqual(slideSchema.parse(slide), slide);
});

test('sources/conclusion prohibit images; sources reject invalid URLs', () => {
  assert.equal(sourceSchema.safeParse({ title: 'x', url: 'javascript:alert(1)' }).success, false);
  assert.equal(sourceSchema.safeParse({ title: 'x' }).success, false);
  for (const layout of ['sources', 'conclusion'] as const) {
    const slide = slideFixture(layout);
    slide.sources = [{ title: 'Test', organization: 'Test harness' }];
    slide.visual = { needed: true, type: 'photo', concept: 'x', query_en: 'x', placement: 'right' };
    assert.equal(slideSchema.safeParse(slide).success, false);
  }
});

test('sequence and layout repetition are explicit gates', () => {
  const deck = presentationFixture(requests[0]!);
  deck.slides[1]!.number = 1;
  assert.equal(presentationSchema.safeParse(deck).success, false);
  deck.slides[1]!.number = 2;
  deck.slides[1] = slideFixture('definition', 2);
  deck.slides[2] = slideFixture('definition', 3);
  deck.slides[3] = slideFixture('definition', 4);
  assert.equal(presentationSchema.safeParse(deck).success, false);
  deck.slides[3]!.repetitionReason = 'Repeated format requested for side-by-side classroom exercise';
  assert.equal(presentationSchema.safeParse(deck).success, true);
});
