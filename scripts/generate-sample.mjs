import { mkdir, writeFile } from 'node:fs/promises';
import { renderPresentation } from '../dist/src/renderer/pptx.js';

const presentation = {
  chatId: 'sample-chat',
  presentation: { fullTopic: 'Пример титульного слайда', displayTitle: 'Пример титульного слайда', subject: 'Информатика', studentName: 'Sample', group: '1', slideCount: 1, style: 'deep_blue', language: 'ru' },
  slides: [{ number: 1, type: 'title', layout: 'title', title: 'Пример титульного слайда', subtitle: '', bullets: [], cards: [], columns: [], comparison: null, statistics: null, chart: null, timeline: [], steps: [], definition: null, quote: null, visual: { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' }, sources: [] }],
};
const output = await renderPresentation(presentation);
await mkdir('work', { recursive: true });
await writeFile('work/title-sample.pptx', output);
console.log(`Generated work/title-sample.pptx (${output.byteLength} bytes)`);
