import assert from 'node:assert/strict';
import { test } from 'node:test';
import { adaptLegacyPayload, LegacyAdaptationError } from '../src/presentation/legacyAdapter.js';
import { presentationFixture, requests } from './regression/fixtures.js';

function legacySlidesFor(requestIndex: number): Record<string, unknown>[] {
  const canonical = presentationFixture(requests[requestIndex]!) as unknown as Record<string, unknown>;
  return (canonical.slides as Record<string, unknown>[]).map((slide, index) => ({
    ...slide,
    layout: index === 0 ? 'title' : index === requests[requestIndex]!.slideCount - 1 ? 'conclusion' : (index % 2 === 0 ? 'image_text' : 'hero'),
    cards: index === requests[requestIndex]!.slideCount - 1 ? slide.cards : [],
    bullets: ['Тезис — текст'],
    subtitle: 'Утверждение',
    comparison: null, statistics: null, timeline: [], steps: [], sources: [],
    definition: undefined, quote: undefined,
  }));
}

test('legacy adapter preserves FSM metadata and maps cards.description explicitly', () => {
  const request = requests[1]!;
  const slides = legacySlidesFor(1).map((slide) => ({ ...slide, cards: (slide.cards as Record<string, unknown>[]).map((card) => ({ title: card.title, description: card.text })) }));
  const result = adaptLegacyPayload({ chatId: 'fixture-chat', presentation: { title: 'Короткий заголовок' }, slides }, request);
  assert.equal(result.presentation.subject, 'Информатик');
  assert.equal(result.presentation.studentName, 'Ох');
  assert.equal(result.presentation.group, '4');
  assert.equal(result.presentation.displayTitle, 'Короткий заголовок');
  assert.equal(result.slides[1]!.cards.length, 0);
});

test('adapter rejects lossy statistics, sources, and missing visual type', () => {
  const request = requests[0]!;
  const slides = legacySlidesFor(0);
  slides[1] = { ...slides[1], layout: 'statistics', statistics: { value: '3.2x', label: 'x', description: 'x' } };
  assert.throws(() => adaptLegacyPayload({ chatId: 'fixture-chat', presentation: { title: 'Fixture' }, slides }, request), LegacyAdaptationError);
  slides[1] = { ...slides[1], layout: 'image_text', statistics: null, visual: { needed: true, query_en: 'student classroom' } };
  assert.throws(() => adaptLegacyPayload({ chatId: 'fixture-chat', presentation: { title: 'Fixture' }, slides }, request), /visual.type/);
  slides[1] = { ...slides[1], visual: { needed: false }, sources: ['Unknown source'] };
  assert.throws(() => adaptLegacyPayload({ chatId: 'fixture-chat', presentation: { title: 'Fixture' }, slides }, request), /plain strings/);
});
test('adapter rejects incomplete comparison and two-column bullet fallback seen in production', () => {
  const request = requests[0]!;

  const comparisonSlides = legacySlidesFor(0);
  comparisonSlides[1] = {
    ...comparisonSlides[1],
    layout: 'comparison',
    comparison: { leftTitle: 'До', rightTitle: 'После' },
    visual: { needed: false },
  };
  assert.throws(
    () => adaptLegacyPayload({ chatId: 'fixture-chat', presentation: { title: 'Fixture' }, slides: comparisonSlides }, request),
    /comparison\.leftItems/,
  );

  const columnSlides = legacySlidesFor(0);
  columnSlides[1] = {
    ...columnSlides[1],
    layout: 'two_column',
    bullets: ['Тезис вместо обязательных columns'],
    visual: { needed: false },
  };
  assert.throws(
    () => adaptLegacyPayload({ chatId: 'fixture-chat', presentation: { title: 'Fixture' }, slides: columnSlides }, request),
    /Exactly two columns required/,
  );
});
