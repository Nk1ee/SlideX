import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slideSchema } from '../dist/src/presentation/schema.js';
import { createGeminiSlideQualityEvaluator } from '../dist/src/qc/geminiSlideEvaluator.js';
import { assertSlideAiReportContext, slideAiQualityReportSchema } from '../dist/src/qc/visualAi.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = join(root, 'tests', 'visual-regression');
const outputPath = resolve(process.argv[2] ?? join(root, 'work', 'visual-regression-report.json'));
const model = process.env.GEMINI_QC_MODEL ?? '';
const evaluate = createGeminiSlideQualityEvaluator({
  apiKey: process.env.GEMINI_API_KEY ?? '', model, timeoutMs: 60_000,
});
const manifest = JSON.parse(await readFile(join(fixtureDir, 'manifest.json'), 'utf8'));
if (manifest.version !== 1 || !Array.isArray(manifest.cases) || manifest.cases.length === 0) {
  throw new Error('Invalid visual regression manifest');
}
let previousResults = [];
try {
  const previous = JSON.parse(await readFile(outputPath, 'utf8'));
  if (previous.model === model && previous.fixtureVersion === manifest.version && Array.isArray(previous.results)) {
    previousResults = previous.results;
  }
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
}

async function evaluateWithRetry(input) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await evaluate(input);
    } catch (error) {
      const temporary = error instanceof Error && /HTTP (429|500|502|503|504)/.test(error.message);
      if (!temporary || attempt === 3) throw error;
      console.warn(`Temporary Gemini failure; retrying attempt ${attempt + 1}/3.`);
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 2_000));
    }
  }
  throw new Error('Unreachable visual regression retry state');
}

const results = [];
for (const item of manifest.cases) {
  if (!/^[a-z0-9-]+$/.test(item.id) || !['accept', 'reject'].includes(item.expectedDecision)) {
    throw new Error('Invalid visual regression case');
  }
  const slide = slideSchema.parse(JSON.parse(await readFile(join(fixtureDir, item.slide), 'utf8')));
  if (slide.layout !== item.layout) throw new Error(`Layout mismatch in ${item.id}`);
  const png = new Uint8Array(await readFile(join(fixtureDir, item.png)));
  const pngSha256 = createHash('sha256').update(png).digest('hex');
  const cached = previousResults.find((result) => result.id === item.id && result.layout === item.layout && result.pngSha256 === pngSha256);
  let report;
  if (cached) {
    report = slideAiQualityReportSchema.parse(cached.report);
    assertSlideAiReportContext(report, slide);
    console.log(`${item.id}: using cached report`);
  } else {
    report = await evaluateWithRetry({ slide, png });
  }
  const decisionMatches = report.decision === item.expectedDecision;
  const defectMatches = item.expectedFailedCheck === null || report.checks[item.expectedFailedCheck] === 'fail';
  const result = { id: item.id, layout: item.layout, pngSha256, expectedDecision: item.expectedDecision,
    expectedFailedCheck: item.expectedFailedCheck, decisionMatches, defectMatches,
    actualDecision: report.decision, report };
  results.push(result);
  console.log(`${item.id}: expected ${item.expectedDecision}, actual ${report.decision}${decisionMatches && defectMatches ? ' ✓' : ' MISMATCH'}`);
  await writeFile(outputPath, JSON.stringify({ model, fixtureVersion: manifest.version, completed: results.length, total: manifest.cases.length, results }, null, 2) + '\n');
}
const matched = results.filter((result) => result.decisionMatches && result.defectMatches).length;
const falseAccept = results.filter((result) => result.expectedDecision === 'reject' && result.actualDecision === 'accept').length;
const falseReject = results.filter((result) => result.expectedDecision === 'accept' && result.actualDecision === 'reject').length;
const review = results.filter((result) => result.actualDecision === 'review').length;
const summary = { model, fixtureVersion: manifest.version, matched, total: results.length, falseAccept, falseReject, review, results };
await writeFile(outputPath, JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ matched, total: results.length, falseAccept, falseReject, review, outputPath }, null, 2));
if (matched !== results.length) process.exitCode = 1;
