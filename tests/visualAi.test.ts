import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageAiQualityReportSchema, slideAiQualityReportSchema } from '../src/qc/visualAi.js';

const acceptedImageReport = {
  kind: 'image',
  decision: 'accept',
  confidence: 'high',
  relevance: 'strong',
  educationalValue: 'explains',
  genericStock: false,
  containsText: false,
  textLegibility: 'not_applicable',
  observedElements: ['neural network nodes', 'connections between layers'],
  mismatch: null,
  reason: 'The diagram directly explains the slide concept.',
} as const;

test('image AI report accepts a consistent strict response', () => {
  assert.equal(imageAiQualityReportSchema.parse(acceptedImageReport).decision, 'accept');
});

test('image AI report rejects unknown fields and inconsistent acceptance', () => {
  assert.equal(imageAiQualityReportSchema.safeParse({ ...acceptedImageReport, score: 98 }).success, false);
  assert.equal(imageAiQualityReportSchema.safeParse({ ...acceptedImageReport, relevance: 'none' }).success, false);
  assert.equal(imageAiQualityReportSchema.safeParse({ ...acceptedImageReport, genericStock: true }).success, false);
  assert.equal(imageAiQualityReportSchema.safeParse({ ...acceptedImageReport, educationalValue: 'decorative' }).success, false);
  assert.equal(imageAiQualityReportSchema.safeParse({ ...acceptedImageReport, containsText: true, textLegibility: 'unreadable' }).success, false);
});

test('image AI report keeps uncertain output out of the accepted state', () => {
  const report = imageAiQualityReportSchema.parse({
    ...acceptedImageReport,
    decision: 'review',
    confidence: 'low',
    relevance: 'uncertain',
    educationalValue: 'uncertain',
    reason: 'The subject cannot be identified with confidence.',
  });
  assert.equal(report.decision, 'review');
});

test('slide AI report cannot accept failed visual checks', () => {
  const report = {
    kind: 'slide',
    decision: 'accept',
    confidence: 'high',
    checks: {
      textReadability: 'pass',
      overlap: 'fail',
      clipping: 'pass',
      contrast: 'pass',
      hierarchy: 'pass',
      imageAlignment: 'pass',
      sourcesReadability: 'not_applicable',
      conclusionReadability: 'not_applicable',
    },
    issues: [],
    reason: 'The slide is readable.',
  };
  assert.equal(slideAiQualityReportSchema.safeParse(report).success, false);
  assert.equal(slideAiQualityReportSchema.safeParse({
    ...report,
    checks: { ...report.checks, overlap: 'pass', hierarchy: 'uncertain' },
  }).success, false);
});
