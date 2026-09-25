import { mkdir, writeFile } from 'node:fs/promises';
import { createWikimediaProvider } from '../dist/src/images/providers.js';
import { createImageResolver } from '../dist/src/images/resolve.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';
import { assertValidPptx } from '../dist/src/qc/pptxValidation.js';

const presentation = {
  chatId: 'sample-image',
  presentation: { fullTopic: 'Схема нейронной сети', displayTitle: 'Схема нейронной сети', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 1, style: 'deep_blue', language: 'ru' },
  slides: [{ number: 1, type: 'content', layout: 'image_text', title: 'Схема нейронной сети', subtitle: '', bullets: ['Иллюстрация показывает связи между слоями нейронной сети'], cards: [], columns: [], comparison: null, statistics: null, chart: null, timeline: [], steps: [], definition: null, quote: null,
    visual: { needed: true, type: 'diagram', concept: 'neural network diagram', query_en: 'neural network diagram', placement: 'right' }, sources: [] }],
};
const issues = [];
const imageResolver = createImageResolver({ providers: [createWikimediaProvider()], onIssue: (issue) => issues.push(issue) });
try {
  const output = await renderPresentation(presentation, { imageResolver });
  await assertValidPptx(output, { expectedSlideCount: 1, imagesExpected: true });
  await mkdir('work', { recursive: true });
  await writeFile('work/image-sample.pptx', output);
  console.log(`Generated work/image-sample.pptx (${output.byteLength} bytes)`);
} catch (error) {
  console.error('Image sample failed:', error instanceof Error ? error.message : String(error));
  if (issues.length) console.error('Image quality checks:', issues);
  process.exitCode = 1;
}
