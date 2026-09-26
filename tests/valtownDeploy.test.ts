import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

test('Val Town deploy defaults to a network-free dry run', () => {
  const output = execFileSync(process.execPath, [resolve('scripts/deploy-valtown-project.mjs')], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      VAL_TOWN_API_KEY: 'must-not-appear',
      VAL_TOWN_VAL_ID: 'must-not-appear',
    },
  });
  const report = JSON.parse(output) as {
    mode: string;
    directoryCount: number;
    fileCount: number;
    directories: string[];
    files: Array<{ path: string; type: string }>;
  };
  assert.equal(report.mode, 'dry-run');
  assert.equal(report.directoryCount, 6);
  assert.equal(report.fileCount, 24);
  assert.ok(report.directories.includes('src/renderer'));
  assert.deepEqual(report.files.find((file) => file.path === 'main.ts'), { path: 'main.ts', type: 'http' });
  assert.equal(output.includes('must-not-appear'), false);
  assert.equal(report.files.some((file) => file.path.includes('.vt') || file.path.includes('node_modules')), false);
});