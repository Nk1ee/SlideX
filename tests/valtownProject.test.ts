import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';

async function javascriptFiles(root: string, current = root): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...await javascriptFiles(root, absolute));
    else if (entry.name.endsWith('.js')) result.push(path.relative(root, absolute).replaceAll(path.sep, '/'));
  }
  return result.sort();
}

test('generated Val Town project matches its compiled canonical modules', async () => {
  const root = process.cwd();
  const compiledRoot = path.join(root, 'dist', 'src');
  const projectRoot = path.join(root, 'integrations', 'valtown', 'project');
  const deployedRoot = path.join(projectRoot, 'src');
  const manifest = JSON.parse(await readFile(path.join(projectRoot, 'manifest.json'), 'utf8')) as { files: string[] };
  const deployedFiles = await javascriptFiles(deployedRoot);
  assert.deepEqual(deployedFiles, [...manifest.files].sort());

  const deployedSet = new Set(deployedFiles);
  for (const relative of deployedFiles) {
    const [compiled, deployed] = await Promise.all([
      readFile(path.join(compiledRoot, relative), 'utf8'),
      readFile(path.join(deployedRoot, relative), 'utf8'),
    ]);
    assert.equal(deployed, compiled, relative + ' is stale; run npm run valtown:build');

    const importPattern = /from ['"](\.[^'"]+)['"]/g;
    for (const match of deployed.matchAll(importPattern)) {
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(relative), match[1]!));
      assert.ok(deployedSet.has(dependency), relative + ' imports missing deploy module ' + dependency);
    }
  }
});

test('Val Town import map pins the same runtime dependency versions', async () => {
  const root = process.cwd();
  const packageJson = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8')) as {
    dependencies: Record<string, string>;
  };
  const denoConfig = JSON.parse(await readFile(path.join(root, 'integrations', 'valtown', 'project', 'deno.json'), 'utf8')) as {
    imports: Record<string, string>;
  };
  for (const dependency of ['jszip', 'pptxgenjs', 'zod']) {
    assert.equal(denoConfig.imports[dependency], 'npm:' + dependency + '@' + packageJson.dependencies[dependency]);
  }
});
