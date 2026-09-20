import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const read = (path: string): string => readFileSync(path, 'utf8');
const workflow = JSON.parse(read('legacy/n8n/workflow.json')) as {
  nodes: { name: string; parameters: { jsCode?: string } }[];
};

test('archival snapshot matches recorded hashes and extracted node code', () => {
  const manifest = JSON.parse(read('legacy/manifest.json')) as { files: { path: string; sha256: string }[] };
  for (const file of manifest.files) {
    assert.equal(createHash('sha256').update(readFileSync(file.path)).digest('hex'), file.sha256, file.path);
  }
  for (const [name, file] of [['FSM Engine', 'fsm-engine'], ['Parse Structure', 'parse-structure'], ['Quality Control Gate', 'quality-control-gate']]) {
    assert.equal(workflow.nodes.find(node => node.name === name)?.parameters.jsCode, read('legacy/n8n/' + file + '.js'));
  }
});

function runLegacy(slides: unknown[], count: number): { presentation: { subject: string; studentName: string; group: string }; slides: Record<string, unknown>[] } {
  const response = { candidates: [{ content: { parts: [{ text: JSON.stringify({ presentation: { title: 'Fixture' }, slides }) }] } }] };
  const result: unknown = runInNewContext('(function () {' + read('legacy/n8n/parse-structure.js') + '\n})()', {
    $input: { first: () => ({ json: response }) },
    $: (name: string) => {
      assert.equal(name, 'FSM Engine');
      return { item: { json: { chatId: 'fixture', presentationRequest: { topic: 'Fixture', subject: 'Информатик', studentName: 'Ох', group: '4', slideCount: count, style: 'deep_blue', language: 'ru' } } } };
    },
  }, { timeout: 1000, contextCodeGeneration: { strings: false, wasm: false } });
  return JSON.parse(JSON.stringify(result))[0].json;
}

// Characterization of frozen legacy defects, not desired behavior for src/.
test('legacy preserves supplied spelling and rejects mismatched count', () => {
  const slides = [{ layout: 'title', title: 'Fixture' }, { layout: 'conclusion', title: 'End' }];
  const result = runLegacy(slides, 2);
  assert.equal(result.presentation.subject, 'Информатик');
  assert.equal(result.presentation.studentName, 'Ох');
  assert.equal(result.presentation.group, '4');
  assert.throws(() => runLegacy(slides, 3), /Ожидалось 3/);
});

test('documented legacy defect: quote, definition and visual concept are lost', () => {
  const result = runLegacy([
    { layout: 'title', title: 'Start' },
    { layout: 'quote', title: 'Middle', quote: { text: 'Synthetic quote', author: 'Fixture' }, definition: { term: 'Fixture', meaning: 'Test' }, visual: { needed: true, concept: 'specific concept', type: 'photo', query_en: 'specific concept' } },
    { layout: 'sources', title: 'Sources', sources: ['Fixture only'] },
  ], 3);
  assert.equal(result.slides[1]?.quote, undefined);
  assert.equal(result.slides[1]?.definition, undefined);
  assert.equal((result.slides[1]?.visual as Record<string, unknown>).concept, undefined);
  assert.equal(result.slides[2]?.layout, 'conclusion');
});

