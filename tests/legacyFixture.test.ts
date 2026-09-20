import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { adaptLegacyPayload, LegacyAdaptationError } from '../src/presentation/legacyAdapter.js';
import { requests } from './regression/fixtures.js';

test('production-like legacy parse fixture is rejected when provenance is unrecoverable', () => {
  const payload = JSON.parse(readFileSync('tests/fixtures/legacy-parse-output.json', 'utf8')) as unknown;
  assert.throws(() => adaptLegacyPayload(payload, { ...requests[0]!, slideCount: 3 }), LegacyAdaptationError);
});
