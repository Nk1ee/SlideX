import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePresentation } from '../src/presentation/normalize.js';
import { validateAndNormalizePresentation } from '../src/presentation/validator.js';
import { presentationFixture, requests } from './regression/fixtures.js';

test('normalization cleans AI text but preserves FSM metadata and statistic units', () => {
  const request = { ...requests[1]!, subject: 'Информатик', studentName: 'Ох', group: ' 4 ' };
  const presentation = presentationFixture(request);
  presentation.presentation.displayTitle = '  ИИ - в образовании  ';
  presentation.slides[1]!.bullets = ['  Адаптивное обучение - это методика  '];
  presentation.slides[1]!.visual.query_en = '  student   AI   classroom  ';
  presentation.slides[1]!.statistics = [{ value: '3.2x', label: '  Рост - показатель ', description: '  Проверенное описание  ', source: { title: ' Source ', organization: ' Test ' } }];

  const normalized = normalizePresentation(presentation);
  assert.equal(normalized.presentation.fullTopic, request.topic);
  assert.equal(normalized.presentation.subject, 'Информатик');
  assert.equal(normalized.presentation.studentName, 'Ох');
  assert.equal(normalized.presentation.group, ' 4 ');
  assert.equal(normalized.presentation.displayTitle, 'ИИ — в образовании');
  assert.equal(normalized.slides[1]!.bullets[0], 'Адаптивное обучение — это методика');
  assert.equal(normalized.slides[1]!.visual.query_en, 'student AI classroom');
  assert.equal(normalized.slides[1]!.statistics?.[0]?.value, '3.2x');
  assert.equal(normalized.slides[1]!.statistics?.[0]?.label, 'Рост — показатель');
});

test('normalization does not create absent content', () => {
  const presentation = presentationFixture(requests[0]!);
  const before = structuredClone(presentation);
  const normalized = normalizePresentation(presentation);
  assert.equal(normalized.slides.length, before.slides.length);
  assert.deepEqual(normalized.slides.map((slide) => slide.quote), before.slides.map((slide) => slide.quote));
  assert.deepEqual(normalized.slides.map((slide) => slide.statistics), before.slides.map((slide) => slide.statistics));
  assert.deepEqual(normalized.slides.map((slide) => slide.sources), before.slides.map((slide) => slide.sources));
});

test('pipeline validates before normalization', () => {
  const request = requests[0]!;
  const presentation = presentationFixture(request);
  presentation.presentation.subject = 'Информатик';
  assert.throws(() => validateAndNormalizePresentation(presentation, request));
  presentation.presentation.subject = request.subject;
  presentation.slides[1]!.title = '  Заголовок - с пробелами  ';
  const result = validateAndNormalizePresentation(presentation, request);
  assert.equal(result.slides[1]!.title, 'Заголовок — с пробелами');
});

