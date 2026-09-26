import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'dist', 'src');
const output = path.join(root, 'integrations', 'valtown', 'project');
const allowedParent = path.join(root, 'integrations', 'valtown');

const dependencyImports = {
  jszip: 'npm:jszip@3.10.2',
  pptxgenjs: 'npm:pptxgenjs@3.12.0',
  zod: 'npm:zod@4.6.5',
};

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

function forValTownRuntime(content) {
  let transformed = content;
  for (const [specifier, pinned] of Object.entries(dependencyImports)) {
    transformed = transformed
      .replaceAll("from '" + specifier + "'", "from '" + pinned + "'")
      .replaceAll('from "' + specifier + '"', 'from "' + pinned + '"')
      .replaceAll("import('" + specifier + "')", "import('" + pinned + "')")
      .replaceAll('import("' + specifier + '")', 'import("' + pinned + '")');
  }
  return transformed;
}

const compiledFiles = new Map();
for (const relative of runtimeFiles) {
  compiledFiles.set(relative, await readFile(path.join(source, relative), 'utf8'));
}

let vtState;
try {
  vtState = await readFile(path.join(output, '.vt', 'state.json'), 'utf8');
} catch (error) {
  if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error;
}

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const relative of runtimeFiles) {
  const target = path.join(output, 'src', relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, forValTownRuntime(compiledFiles.get(relative)), 'utf8');
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

const denoConfig = { imports: dependencyImports };

await writeFile(path.join(output, 'main.ts'), entry, 'utf8');
await writeFile(path.join(output, 'deno.json'), JSON.stringify(denoConfig, null, 2) + '\n', 'utf8');
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ files: runtimeFiles }, null, 2) + '\n', 'utf8');
if (vtState !== undefined) {
  await mkdir(path.join(output, '.vt'), { recursive: true });
  await writeFile(path.join(output, '.vt', 'state.json'), vtState, 'utf8');
}
console.log('Built Val Town project at ' + output);