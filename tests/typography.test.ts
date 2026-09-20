import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertTypographyConfig, DEFAULT_TYPOGRAPHY, typographyFor } from '../src/renderer/typography.js';

test('typography roles provide one consistent base style per role', () => {
  assertTypographyConfig(DEFAULT_TYPOGRAPHY);
  assert.equal(typographyFor('TITLE').preferredFontSize, typographyFor('TITLE').preferredFontSize);
  assert.equal(typographyFor('BODY').preferredFontSize, 16);
  assert.equal(typographyFor('BODY').minFontSize, 14);
  assert.equal(typographyFor('BODY', { preferredFontSize: 14, minFontSize: 14 }).preferredFontSize, 14);
});

test('typography rejects invalid institutional configurations', () => {
  assert.throws(() => assertTypographyConfig({ ...DEFAULT_TYPOGRAPHY, BODY: { ...DEFAULT_TYPOGRAPHY.BODY, minFontSize: 18 } }));
  assert.throws(() => assertTypographyConfig({ ...DEFAULT_TYPOGRAPHY, TITLE: { ...DEFAULT_TYPOGRAPHY.TITLE, fontFace: '  ' } }));
});
