import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import JSZip from 'jszip';
import { slideSchema } from '../src/presentation/schema.js';
import { assertValidPptx } from '../src/qc/pptxValidation.js';

type RegressionCase = {
  id: string;
  expectedDecision: 'accept' | 'reject';
  expectedFailedCheck: string | null;
  layout: string;
  slide: string;
  png: string;
  pptx: string;
  pptxSlideNumber: number;
};

const fixtureDir = join(process.cwd(), 'tests', 'visual-regression');

test('visual regression fixtures contain matching canonical slides, real PNGs and valid PPTX', async () => {
  const manifest = JSON.parse(await readFile(join(fixtureDir, 'manifest.json'), 'utf8')) as { version: number; cases: RegressionCase[] };
  assert.equal(manifest.version, 1);
  assert.equal(manifest.cases.length, 7);
  assert.equal(new Set(manifest.cases.map((item) => item.id)).size, manifest.cases.length);
  assert.deepEqual(new Set(manifest.cases.filter((item) => item.expectedDecision === 'accept').map((item) => item.layout)),
    new Set(['title', 'hero', 'definition', 'sources', 'conclusion']));
  const validatedDecks = new Set<string>();
  const deckCache = new Map<string, JSZip>();
  for (const item of manifest.cases) {
    assert.match(item.id, /^[a-z0-9-]+$/);
    const slide = slideSchema.parse(JSON.parse(await readFile(join(fixtureDir, item.slide), 'utf8')) as unknown);
    assert.equal(slide.layout, item.layout);
    assert.equal(slide.number, item.pptxSlideNumber);
    const png = await readFile(join(fixtureDir, item.png));
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(png.readUInt32BE(16), 1600);
    assert.equal(png.readUInt32BE(20), 900);
    if (item.expectedDecision === 'reject') assert.ok(['overlap', 'clipping'].includes(item.expectedFailedCheck ?? ''));
    else assert.equal(item.expectedFailedCheck, null);
    const deckPath = join(fixtureDir, item.pptx);
    const deck = await readFile(deckPath);
    if (!validatedDecks.has(item.pptx)) {
      validatedDecks.add(item.pptx);
      const expectedSlides = item.pptx === 'assets/good.pptx' ? 5 : 1;
      await assertValidPptx(deck, { expectedSlideCount: expectedSlides, imagesExpected: false });
    }
    const zip = deckCache.get(item.pptx) ?? await JSZip.loadAsync(deck);
    deckCache.set(item.pptx, zip);
    const slideXml = await zip.file(`ppt/slides/slide${item.pptxSlideNumber}.xml`)?.async('string');
    assert.ok(slideXml?.includes(slide.title), `${item.id} PPTX must contain its canonical title`);
    if (item.pptx === 'assets/good.pptx') {
      const titleXml = await zip.file('ppt/slides/slide1.xml')?.async('string');
      assert.ok(titleXml?.includes('Информатик'));
      assert.ok(titleXml?.includes('Ох'));
    }
  }
});
