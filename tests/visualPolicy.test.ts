import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classifySubject, recommendVisualFormat, schoolBandFor, schoolGradeFromClass, visualBudgetFor } from '../src/presentation/visualPolicy.js';

test('subject classification tolerates user spelling without changing metadata', () => {
  assert.equal(classifySubject('Информатик'), 'technical');
  assert.equal(classifySubject('История'), 'history_social');
  assert.equal(classifySubject('Биология'), 'natural_science');
});

test('school grade changes visual support without being guessed from group', () => {
  assert.equal(schoolBandFor({ educationStage: 'school', schoolClass: '3Б', task: 'class_report' }), 'primary');
  assert.equal(schoolBandFor({ educationStage: 'school', schoolClass: '9', task: 'class_report' }), 'high');
  assert.equal(schoolBandFor({ educationStage: 'college', course: '2', task: 'class_report' }), 'not_applicable');
  assert.equal(schoolBandFor({ educationStage: 'unknown', task: 'unknown' }), 'unknown');
  assert.equal(schoolGradeFromClass('8Г'), 8);
  assert.equal(schoolGradeFromClass('12А'), null);
});

test('visual recommendation follows slide purpose before subject decoration', () => {
  const base = { subject: 'История', learning: { educationStage: 'school' as const, schoolClass: '7Б', task: 'class_report' as const }, slideCount: 10, hasSourcedNumericData: false };
  assert.equal(recommendVisualFormat({ ...base, slidePurpose: 'chronology' }).format, 'timeline');
  assert.equal(recommendVisualFormat({ ...base, slidePurpose: 'process' }).format, 'diagram');
  assert.equal(recommendVisualFormat({ ...base, slidePurpose: 'person' }).format, 'photo');
  assert.equal(recommendVisualFormat({ ...base, slidePurpose: 'sources' }).format, 'none');
});

test('chart is allowed only for supplied sourced numeric evidence', () => {
  const base = { subject: 'Экономика', learning: { educationStage: 'university' as const, course: '3', task: 'research_report' as const }, slideCount: 13, slidePurpose: 'evidence' as const };
  assert.equal(recommendVisualFormat({ ...base, hasSourcedNumericData: true }).format, 'chart');
  const withoutData = recommendVisualFormat({ ...base, hasSourcedNumericData: false });
  assert.notEqual(withoutData.format, 'chart');
  assert.ok(withoutData.reasons.includes('chart_forbidden_without_sourced_numeric_data'));
});

test('primary school gets illustration support only when the slide purpose allows it', () => {
  const base = { subject: 'Литература', learning: { educationStage: 'school' as const, schoolClass: '2А', task: 'explain_topic' as const }, slideCount: 6, hasSourcedNumericData: false };
  assert.equal(recommendVisualFormat({ ...base, slidePurpose: 'introduce' }).format, 'illustration');
  assert.equal(recommendVisualFormat({ ...base, slidePurpose: 'quote' }).format, 'none');
});

test('presentation task changes the recommendation for the same introductory slide', () => {
  const base = { subject: 'Литература', educationStage: 'university' as const, slideCount: 10, slidePurpose: 'introduce' as const, hasSourcedNumericData: false };
  const biography = recommendVisualFormat({ ...base, learning: { educationStage: base.educationStage, course: '3', task: 'biography' } });
  const research = recommendVisualFormat({ ...base, learning: { educationStage: base.educationStage, course: '3', task: 'research_report' } });
  assert.equal(biography.format, 'photo');
  assert.equal(research.format, 'diagram');
});

test('slide count produces a ceiling, not a requirement to add bad visuals', () => {
  assert.deepEqual(visualBudgetFor(10, 'class_report'), { contentSlides: 8, targetRichSlides: 4, maxRichSlides: 6, maxChartSlides: 1, maxSameFormatInRow: 2 });
  assert.deepEqual(visualBudgetFor(13, 'research_report'), { contentSlides: 11, targetRichSlides: 7, maxRichSlides: 8, maxChartSlides: 4, maxSameFormatInRow: 2 });
  assert.equal(visualBudgetFor(1, 'research_report').maxChartSlides, 0);
  assert.throws(() => visualBudgetFor(0, 'unknown'), /positive integer/);
});
