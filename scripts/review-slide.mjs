import { readFile, writeFile } from 'node:fs/promises';
import { slideSchema } from '../dist/src/presentation/schema.js';
import { createGeminiSlideQualityEvaluator } from '../dist/src/qc/geminiSlideEvaluator.js';

const [pngPath, slideJsonPath, outputPath] = process.argv.slice(2);
if (!pngPath || !slideJsonPath) {
  throw new Error('Usage: npm run review:slide -- <rendered-slide.png> <canonical-slide.json> [report.json]');
}
const apiKey = process.env.GEMINI_API_KEY ?? '';
const model = process.env.GEMINI_QC_MODEL ?? '';
const slide = slideSchema.parse(JSON.parse(await readFile(slideJsonPath, 'utf8')));
const png = new Uint8Array(await readFile(pngPath));
const evaluate = createGeminiSlideQualityEvaluator({ apiKey, model, timeoutMs: 60_000 });
const report = await evaluate({ slide, png });
const result = JSON.stringify({ slideNumber: slide.number, layout: slide.layout, model, report }, null, 2);
if (outputPath) await writeFile(outputPath, result + '\n');
console.log(result);
