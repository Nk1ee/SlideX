import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { test } from 'node:test';
import { themeIdSchema, userRequestSchema } from '../src/presentation/schema.js';
import { PRESENTATION_THEMES } from '../src/presentation/themes.js';
import type { ThemeId, UserRequest } from '../src/presentation/types.js';
import { validatePresentation } from '../src/presentation/validator.js';
import { validatePptxBinary } from '../src/qc/pptxValidation.js';
import { renderPresentation } from '../src/renderer/pptx.js';
import { slideFixture } from './regression/fixtures.js';

function relativeLuminance(hex: string): number {
  const channels = [0, 2, 4].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) / (Math.min(firstLuminance, secondLuminance) + 0.05);
}

function themedFixture(style: ThemeId) {
  const request: UserRequest = {
    topic: 'Проверка визуальной темы', subject: 'Информатика', studentName: 'Ох', group: '4', slideCount: 3, style,
  };
  const title = slideFixture('title', 1);
  title.title = 'Проверка визуальной темы';
  const sources = slideFixture('sources', 2);
  sources.title = 'Источники';
  sources.cards = [];
  sources.sources = [{ title: 'Документация SlideX', organization: 'SlideX' }];
  const conclusion = slideFixture('conclusion', 3);
  conclusion.title = 'Выводы';
  const input = {
    chatId: 'theme-fixture',
    presentation: {
      fullTopic: request.topic, displayTitle: request.topic, subject: request.subject, studentName: request.studentName,
      group: request.group, slideCount: request.slideCount, style, language: 'ru',
    },
    slides: [title, sources, conclusion],
  };
  return { request, presentation: validatePresentation(input, request) };
}

test('theme contract and catalog contain the same stable identifiers', () => {
  assert.deepEqual(Object.keys(PRESENTATION_THEMES), themeIdSchema.options);
  for (const id of themeIdSchema.options) {
    const theme = PRESENTATION_THEMES[id];
    assert.equal(theme.id, id);
    assert.ok(theme.name.trim());
    assert.ok(theme.paletteName.trim());
    assert.ok(theme.description.trim());
  }
  assert.equal(userRequestSchema.safeParse({
    topic: 'Тест', subject: 'Информатика', studentName: 'Ох', group: '4', slideCount: 3, style: 'unknown_theme',
  }).success, false);
});

test('every theme keeps readable text contrast and valid renderer tokens', () => {
  for (const theme of Object.values(PRESENTATION_THEMES)) {
    for (const color of Object.values(theme.colors)) assert.match(color, /^[0-9A-F]{6}$/, `${theme.id} has invalid color ${color}`);
    for (const role of ['title', 'subtitle', 'body', 'footer'] as const) {
      assert.ok(contrastRatio(theme.colors.background, theme.colors[role]) >= 4.5, `${theme.id}.${role} contrast is below 4.5:1`);
    }
    assert.ok(theme.geometry.titleRuleWidth > 0 && theme.geometry.titleRuleWidth <= 2.5);
    assert.ok(theme.geometry.dividerHeight > 0 && theme.geometry.dividerHeight <= 0.1);
  }
});

test('all themes preserve metadata and render valid title, sources and conclusion slides', async () => {
  for (const id of themeIdSchema.options) {
    const { presentation } = themedFixture(id);
    assert.equal(presentation.presentation.style, id);
    assert.equal(presentation.presentation.studentName, 'Ох');
    assert.equal(presentation.presentation.group, '4');
    const binary = await renderPresentation(presentation);
    assert.equal((await validatePptxBinary(binary, { expectedSlideCount: 3, imagesExpected: false })).ok, true, id);
    const zip = await JSZip.loadAsync(binary);
    const titleXml = await zip.file('ppt/slides/slide1.xml')!.async('string');
    assert.ok(titleXml.includes(PRESENTATION_THEMES[id].colors.background), `${id} background is missing from PPTX`);
    assert.ok(titleXml.includes(PRESENTATION_THEMES[id].colors.accent), `${id} accent is missing from PPTX`);
    const motifCount = titleXml.split('parallelogram').length - 1;
    assert.equal(motifCount, PRESENTATION_THEMES[id].geometry.titleMotif === 'none' ? 0 : 2, `${id} title motif does not match its theme`);
  }
});
