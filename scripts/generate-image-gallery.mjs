import { mkdir, writeFile } from 'node:fs/promises';
import { createUnsplashProvider, createWikimediaProvider } from '../dist/src/images/providers.js';
import { createImageResolver } from '../dist/src/images/resolve.js';
import { validatePresentation } from '../dist/src/presentation/validator.js';
import { assertContentQuality } from '../dist/src/qc/contentValidation.js';
import { assertLayoutPlan } from '../dist/src/qc/layoutValidation.js';
import { assertValidPptx } from '../dist/src/qc/pptxValidation.js';
import { renderPresentation } from '../dist/src/renderer/pptx.js';

if (!process.env.UNSPLASH_ACCESS_KEY) throw new Error('Set UNSPLASH_ACCESS_KEY before running the image gallery');
const noVisual = { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' };
function slide(number, layout, title, extra = {}) {
  return { number, type: ['title', 'sources', 'conclusion'].includes(layout) ? layout : 'content', layout, title, subtitle: '', bullets: [], cards: [], columns: [], comparison: null, statistics: null, timeline: [], steps: [], definition: null, quote: null, visual: noVisual, sources: [], ...extra };
}
const trustedRequest = { topic: 'Подбор изображений для учебных слайдов', subject: 'Информатика', studentName: 'Ох', group: '4', slideCount: 7, style: 'deep_blue' };
const slides = [
  slide(1, 'title', 'Изображения в учебных слайдах'),
  slide(2, 'image_text', 'Учебная аудитория', { bullets: ['Фотография показывает учебную среду: людей, доску и рабочее пространство аудитории.'], visual: { needed: true, type: 'photo', concept: 'students studying in classroom', query_en: 'student classroom study', placement: 'right' } }),
  slide(3, 'definition', 'Визуальный план', { definition: { term: 'Visual concept', text: 'Короткое описание того, что изображение должно показать на конкретном слайде.' } }),
  slide(4, 'image_text', 'Схема нейронной сети', { bullets: ['На схеме показаны узлы и связи между слоями сети.'], visual: { needed: true, type: 'diagram', concept: 'multi layer neural network vector', query_en: 'multi-layer neural network vector', placement: 'left' } }),
  slide(5, 'image_text', 'Книжные стеллажи', { bullets: ['Фотография показывает книжные стеллажи в библиотечном пространстве.'], visual: { needed: true, type: 'photo', concept: 'bookshelves in a library', query_en: 'bookshelves library', placement: 'supporting' } }),
  slide(6, 'sources', 'Источники изображений'),
  slide(7, 'conclusion', 'Что проверяет подбор', { cards: [
    { title: 'Соответствие смыслу', text: 'Запрос строится из визуального плана конкретного слайда.' },
    { title: 'Качество файла', text: 'Перед вставкой проверяются формат, размеры и содержимое изображения.' },
    { title: 'Происхождение', text: 'Подпись и ссылка на источник остаются в презентации.' },
  ] }),
];
const issues = [];
const resolver = createImageResolver({ providers: [createUnsplashProvider(), createWikimediaProvider()], onIssue: issue => issues.push(issue) });
const resolved = new Map();
for (const current of slides.filter(item => item.visual.needed)) {
  const image = await resolver(current);
  if (!image) throw new Error('No relevant image for slide ' + current.number);
  resolved.set(current.number, image);
}
slides[5].sources = [...resolved].map(([number, image]) => ({ title: number === 2 ? 'Фото учебной аудитории' : number === 4 ? 'Схема нейронной сети' : 'Фото книжных стеллажей', ...(image.provider === 'wikimedia' && image.license === 'CC0' ? { organization: 'Wikimedia Commons' } : { author: image.author }), url: image.sourceUrl }));
const input = { chatId: 'image-gallery-sample', presentation: { fullTopic: trustedRequest.topic, displayTitle: 'Изображения в учебных слайдах', subject: trustedRequest.subject, studentName: trustedRequest.studentName, group: trustedRequest.group, slideCount: trustedRequest.slideCount, style: trustedRequest.style, language: 'ru' }, slides };
const presentation = validatePresentation(input, trustedRequest);
assertContentQuality(presentation);
assertLayoutPlan(presentation, new Set(['title', 'definition', 'image_text', 'sources', 'conclusion']));
const binary = await renderPresentation(presentation, { imageResolver: async current => resolved.get(current.number) ?? null });
await assertValidPptx(binary, { expectedSlideCount: trustedRequest.slideCount, imagesExpected: true });
await mkdir('work', { recursive: true });
await writeFile('work/image-gallery.pptx', binary);
await writeFile('work/image-gallery-report.json', JSON.stringify({ slideCount: slides.length, images: [...resolved].map(([number, image]) => ({ slide: number, provider: image.provider, providerId: image.providerId, description: image.altText, author: image.author, license: image.license, sourceUrl: image.sourceUrl, width: image.width, height: image.height })), rejectedCandidates: issues.length }, null, 2));
console.log(JSON.stringify({ file: 'work/image-gallery.pptx', bytes: binary.byteLength, slides: slides.length, images: [...resolved].map(([number, image]) => ({ slide: number, provider: image.provider, id: image.providerId, description: image.altText, dimensions: image.width + 'x' + image.height })), rejectedCandidates: issues.length }, null, 2));
