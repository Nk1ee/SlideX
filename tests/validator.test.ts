import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertRenderable, validatePresentation } from '../src/presentation/validator.js';
import { presentationFixture, requests, slideFixture } from './regression/fixtures.js';

for (const request of requests) {
  test(`canonical contract: ${request.topic} (${request.slideCount})`, () => {
    const input = presentationFixture(request);
    const before = structuredClone(input);
    const result = validatePresentation(input, request);
    assert.equal(result.slides.length, request.slideCount);
    assert.deepEqual(result, before);
    assert.deepEqual(input, before);
    assert.equal(result.presentation.subject, request.subject);
    assert.equal(result.presentation.studentName, request.studentName);
    assert.equal(result.presentation.group, request.group);
    assert.ok(result.slides.every((slide) => slide.quote === null && slide.statistics === null && slide.sources.length === 0));
  });
}

test('FSM metadata is authoritative, including whitespace and misspellings', () => {
  const request = { ...requests[1]!, group: ' 4 ' };
  const valid = presentationFixture(request);
  assert.equal(validatePresentation(valid, request).presentation.group, ' 4 ');
  for (const field of ['fullTopic', 'subject', 'studentName', 'group', 'slideCount', 'style'] as const) {
    const candidate = structuredClone(valid);
    if (field === 'slideCount') {
      candidate.presentation.slideCount += 1;
      candidate.slides.push(slideFixture('definition', candidate.slides.length + 1));
    } else if (field === 'style') {
      assert.throws(() => validatePresentation({ ...valid, presentation: { ...valid.presentation, style: 'other' } }, request));
      continue;
    } else candidate.presentation[field] += 'changed';
    assert.throws(() => validatePresentation(candidate, request), field);
  }
});

test('FSM education context is authoritative and preserved literally', () => {
  const request = { ...requests[0]!, group: '8Г', educationContext: { educationStage: 'school' as const, schoolClass: '8Г' } };
  const valid = presentationFixture(request);
  valid.presentation.educationContext = request.educationContext;
  assert.deepEqual(validatePresentation(valid, request).presentation.educationContext, request.educationContext);
  const changed = structuredClone(valid);
  changed.presentation.educationContext = { educationStage: 'school', schoolClass: '8А' };
  assert.throws(() => validatePresentation(changed, request), /educationContext/);
  assert.throws(() => validatePresentation({ ...valid, presentation: { ...valid.presentation, educationContext: undefined } }, request), /educationContext/);
});

test('count includes sources and conclusion; last slide never rewritten', () => {
  const request = requests[0]!;
  const deck = presentationFixture(request);
  deck.slides[deck.slides.length - 1] = slideFixture('definition', request.slideCount);
  assert.equal(validatePresentation(deck, request).slides.at(-1)?.layout, 'definition');
  deck.slides.push(slideFixture('conclusion', request.slideCount + 1));
  assert.throws(() => validatePresentation(deck, request));
  deck.slides.splice(-2);
  assert.throws(() => validatePresentation(deck, request));
});

test('long title/bullet retained for future fitText overflow gate', () => {
  const request = { ...requests[0]!, topic: 'Очень длинная тема '.repeat(80) };
  const deck = presentationFixture(request);
  deck.slides[1]!.title = 'Длинный заголовок '.repeat(100);
  deck.slides[1]!.bullets = ['Длинный содержательный пункт '.repeat(100)];
  assert.deepEqual(validatePresentation(deck, request), deck);
});

test('no layout is renderable without an implementation registry', () => {
  const deck = validatePresentation(presentationFixture(requests[0]!), requests[0]);
  assert.throws(() => assertRenderable(deck, new Set()), /not implemented/);
  assert.doesNotThrow(() => assertRenderable(deck, new Set(['title', 'definition', 'process', 'conclusion'])));
});

test('malformed inputs reject rather than coerce or fill defaults', () => {
  for (const input of [null, {}, [], 'not json', { presentation: {} }]) {
    assert.throws(() => validatePresentation(input, requests[0]));
  }
});
