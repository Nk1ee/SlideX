import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'dist', 'src');
const output = path.join(root, 'integrations', 'valtown', 'project');
const allowedParent = path.join(root, 'integrations', 'valtown');

const runtimeFiles = [
  'images/dedupe.js',
  'images/download.js',
  'images/providers.js',
  'images/relevance.js',
  'images/resolve.js',
  'images/search.js',
  'images/types.js',
  'integrations/valtownRenderer.js',
  'presentation/normalize.js',
  'presentation/schema.js',
  'presentation/themes.js',
  'presentation/types.js',
  'presentation/validator.js',
  'qc/contentValidation.js',
  'qc/geminiVisualEvaluator.js',
  'qc/layoutValidation.js',
  'qc/pptxValidation.js',
  'qc/visualAi.js',
  'renderer/fitText.js',
  'renderer/pptx.js',
  'renderer/typography.js',
];

if (!output.startsWith(allowedParent + path.sep)) {
  throw new Error('Refusing to replace unexpected output path: ' + output);
}

for (const relative of runtimeFiles) {
  await readFile(path.join(source, relative), 'utf8');
}
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const relative of runtimeFiles) {
  const target = path.join(output, 'src', relative);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(path.join(source, relative), target);
}

const entry = [
  "import { createValTownRendererHandler } from './src/integrations/valtownRenderer.js';",
  '',
  'function readEnvironment(name: string): string | undefined {',
  '  return Deno.env.get(name);',
  '}',
  '',
  'export default createValTownRendererHandler({ readEnvironment });',
  '',
].join('\n');

const denoConfig = {
  imports: {
    jszip: 'npm:jszip@3.10.2',
    pptxgenjs: 'npm:pptxgenjs@3.12.0',
    zod: 'npm:zod@4.6.5',
  },
};

await writeFile(path.join(output, 'main.ts'), entry, 'utf8');
await writeFile(path.join(output, 'deno.json'), JSON.stringify(denoConfig, null, 2) + '\n', 'utf8');
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ files: runtimeFiles }, null, 2) + '\n', 'utf8');
console.log('Built Val Town project at ' + output);
