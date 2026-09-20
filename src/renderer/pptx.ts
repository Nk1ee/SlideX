import * as PptxGenJSModule from 'pptxgenjs';
import { fitText } from './fitText.js';
import { typographyFor } from './typography.js';
import type { Presentation, Slide, Source } from '../presentation/types.js';
import type { ImageCandidate } from '../images/types.js';
import { imageDataUriFromBytes } from '../images/dedupe.js';

const THEME = { background: '0A1128', accent: '38BDF8', title: 'FFFFFF', subtitle: 'CBD5E1', body: 'CBD5E1', footer: '64748B' };
type TextOptions = { x: number; y: number; w: number; h: number; fontFace?: string; fontSize?: number; bold?: boolean; italic?: boolean; color?: string; valign?: 'mid' | 'top'; fit?: 'shrink' };
type ShapeOptions = { x: number; y: number; w: number; h: number; fill: { color: string; transparency?: number }; line: { color: string; transparency: number } };
type ImageOptions = { data: string; x: number; y: number; w: number; h: number };
type PptxSlide = { background: { color: string }; addShape: (shape: 'rect', options: ShapeOptions) => void; addText: (text: string, options: TextOptions) => void; addImage: (options: ImageOptions) => void };
type PptxDocument = { layout: string; author: string; subject: string; title: string; company: string; addSlide: () => PptxSlide; write: (options: { outputType: 'uint8array' }) => Promise<Uint8Array | ArrayBuffer> };
type PptxConstructor = new () => PptxDocument;
export type ImageResolver = (slide: Slide) => Promise<ImageCandidate | null>;
export type RenderOptions = { imageResolver?: ImageResolver };
const PptxGenJS = ((PptxGenJSModule as unknown as { default?: PptxConstructor }).default ?? PptxGenJSModule) as unknown as PptxConstructor;

function renderTitleSlide(presentation: Presentation, slideData: Slide, pptx: PptxDocument): void {
  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  const titleStyle = typographyFor('TITLE');
  const titleFit = fitText({ text: slideData.title, widthInches: 4.5, maxHeightInches: 1.8, preferredFontSize: titleStyle.preferredFontSize, minFontSize: titleStyle.minFontSize });
  if (titleFit.overflow) throw new Error(`Title overflows at minimum ${titleStyle.minFontSize}pt`);
  slide.addShape('rect', { x: 0.8, y: 1.3, w: 0.15, h: 2.7, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  slide.addText(slideData.title, { x: 1.15, y: 1.25, w: 4.5, h: 1.8, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'mid', fit: 'shrink' });
  const subtitleStyle = typographyFor('SUBTITLE');
  slide.addText(`Предмет: ${presentation.presentation.subject}\nСтудент: ${presentation.presentation.studentName} (Группа ${presentation.presentation.group})`, { x: 1.15, y: 3.25, w: 4.5, h: 0.85, fontFace: subtitleStyle.fontFace, fontSize: subtitleStyle.preferredFontSize, color: THEME.subtitle, fit: 'shrink' });
}



function renderHeroSlide(slideData: Slide, pptx: PptxDocument): void {
  if (slideData.visual.needed) throw new Error('Hero layout does not support images in the first extraction');
  if (!slideData.subtitle.trim()) throw new Error('Hero layout requires supplied subtitle thesis');
  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  const labelStyle = typographyFor('LABEL');
  const titleStyle = typographyFor('TITLE');
  const heroStyle = typographyFor('HERO');
  slide.addText('[ КЛЮЧЕВОЙ ТЕЗИС ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  const titleFit = fitText({ text: slideData.title, widthInches: 8.4, maxHeightInches: 0.6, preferredFontSize: titleStyle.preferredFontSize, minFontSize: titleStyle.minFontSize });
  if (titleFit.overflow) throw new Error(`Hero title overflows at minimum ${titleStyle.minFontSize}pt`);
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: 0.03, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  const thesisFit = fitText({ text: slideData.subtitle, widthInches: 7.8, maxHeightInches: 1.7, preferredFontSize: heroStyle.preferredFontSize, minFontSize: heroStyle.minFontSize });
  if (thesisFit.overflow) throw new Error(`Hero thesis overflows at minimum ${heroStyle.minFontSize}pt`);
  slide.addText(slideData.subtitle, { x: 0.8, y: 1.95, w: 7.8, h: Math.max(1.1, thesisFit.estimatedHeight), fontFace: heroStyle.fontFace, fontSize: thesisFit.fontSize, bold: heroStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
}
function renderDefinitionSlide(slideData: Slide, pptx: PptxDocument): void {
  if (slideData.visual.needed) throw new Error('Definition layout cannot contain an image');
  if (slideData.definition === null) throw new Error('Definition layout requires supplied definition data');
  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  const labelStyle = typographyFor('LABEL');
  const titleStyle = typographyFor('TITLE');
  const termStyle = typographyFor('HERO');
  const bodyStyle = typographyFor('BODY');
  slide.addText('[ ОПРЕДЕЛЕНИЕ ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  const titleFit = fitText({ text: slideData.title, widthInches: 8.4, maxHeightInches: 0.6, preferredFontSize: titleStyle.preferredFontSize, minFontSize: titleStyle.minFontSize });
  if (titleFit.overflow) throw new Error(`Definition title overflows at minimum ${titleStyle.minFontSize}pt`);
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: 0.03, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  const termFit = fitText({ text: slideData.definition.term, widthInches: 8.0, maxHeightInches: 0.8, preferredFontSize: termStyle.preferredFontSize, minFontSize: termStyle.minFontSize });
  const bodyFit = fitText({ text: slideData.definition.text, widthInches: 8.0, maxHeightInches: 2.1, preferredFontSize: bodyStyle.preferredFontSize, minFontSize: bodyStyle.minFontSize });
  if (termFit.overflow || bodyFit.overflow) throw new Error('Definition content overflows at readable minimum');
  slide.addText(slideData.definition.term, { x: 0.8, y: 1.75, w: 8.0, h: Math.max(0.8, termFit.estimatedHeight), fontFace: termStyle.fontFace, fontSize: termFit.fontSize, bold: termStyle.bold, color: THEME.accent, valign: 'top', fit: 'shrink' });
  slide.addText(slideData.definition.text, { x: 0.8, y: 2.75, w: 8.0, h: Math.max(1.0, bodyFit.estimatedHeight), fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, color: THEME.body, valign: 'top', fit: 'shrink' });
}
function renderQuoteSlide(slideData: Slide, pptx: PptxDocument): void {
  if (slideData.visual.needed) throw new Error('Quote layout cannot contain an image in the first extraction');
  if (slideData.quote === null) throw new Error('Quote layout requires supplied quote data');
  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  const labelStyle = typographyFor('LABEL');
  const titleStyle = typographyFor('TITLE');
  const quoteStyle = typographyFor('HERO');
  const bodyStyle = typographyFor('BODY');
  slide.addText('[ ЦИТАТА ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  const titleFit = fitText({ text: slideData.title, widthInches: 8.4, maxHeightInches: 0.6, preferredFontSize: titleStyle.preferredFontSize, minFontSize: titleStyle.minFontSize });
  if (titleFit.overflow) throw new Error(`Quote title overflows at minimum ${titleStyle.minFontSize}pt`);
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: 0.03, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  const quoteFit = fitText({ text: slideData.quote.text, widthInches: 7.7, maxHeightInches: 1.65, preferredFontSize: quoteStyle.preferredFontSize, minFontSize: quoteStyle.minFontSize });
  if (quoteFit.overflow) throw new Error(`Quote text overflows at minimum ${quoteStyle.minFontSize}pt`);
  slide.addText('“', { x: 0.78, y: 1.72, w: 0.45, h: 0.7, fontFace: quoteStyle.fontFace, fontSize: 42, bold: true, color: THEME.accent, valign: 'top' });
  slide.addText(slideData.quote.text, { x: 1.35, y: 1.78, w: 7.7, h: Math.max(1.1, quoteFit.estimatedHeight), fontFace: quoteStyle.fontFace, fontSize: quoteFit.fontSize, italic: true, color: THEME.title, valign: 'top', fit: 'shrink' });
  const attribution = `— ${slideData.quote.author}${slideData.quote.source ? `\n${sourceText(slideData.quote.source)}` : ''}`;
  const attributionFit = fitText({ text: attribution, widthInches: 7.7, maxHeightInches: 0.8, preferredFontSize: bodyStyle.preferredFontSize, minFontSize: bodyStyle.minFontSize });
  if (attributionFit.overflow) throw new Error(`Quote attribution overflows at minimum ${bodyStyle.minFontSize}pt`);
  slide.addText(attribution, { x: 1.35, y: 3.72, w: 7.7, h: Math.max(0.55, attributionFit.estimatedHeight), fontFace: bodyStyle.fontFace, fontSize: attributionFit.fontSize, color: THEME.subtitle, valign: 'top', fit: 'shrink' });
}
function renderImageTextSlide(slideData: Slide, pptx: PptxDocument, imageResolver: (slide: Slide) => Promise<ImageCandidate | null>): void | Promise<void> {
  if (!slideData.visual.needed) throw new Error('Image text layout requires visual.needed=true');
  return imageResolver(slideData).then((image) => {
    if (image === null) throw new Error('Image text layout requires a resolved relevant image; switch layout when search fails');
    if (!image.bytes || image.bytes.byteLength === 0) throw new Error('Resolved image has no downloaded bytes');
    if (!['image/jpeg', 'image/png'].includes(image.mimeType)) throw new Error(`Unsupported image MIME type: ${image.mimeType}`);
    const slide = pptx.addSlide();
    slide.background = { color: THEME.background };
    const placement = slideData.visual.placement;
    const fullBleed = placement === 'full' || placement === 'background';
    if (fullBleed) {
      slide.addImage({ data: imageDataUriFromBytes(image.bytes, image.mimeType), x: 0, y: 0, w: 10, h: 5.625 });
      slide.addShape('rect', { x: 0, y: 0, w: 10, h: 5.625, fill: { color: THEME.background, transparency: 28 }, line: { color: THEME.background, transparency: 100 } });
    }
    const labelStyle = typographyFor('LABEL');
    const titleStyle = typographyFor('TITLE');
    const bodyStyle = typographyFor('BODY');
    slide.addText('[ ВИЗУАЛЬНЫЙ КОНТЕКСТ ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
    const titleFit = fitText({ text: slideData.title, widthInches: 8.4, maxHeightInches: 0.6, preferredFontSize: titleStyle.preferredFontSize, minFontSize: titleStyle.minFontSize });
    if (titleFit.overflow) throw new Error(`Image text title overflows at minimum ${titleStyle.minFontSize}pt`);
    slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
    if (!fullBleed) slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: 0.03, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
    const bulletText = slideData.bullets.map((bullet) => `• ${bullet}`).join('\n');
    const imageData = imageDataUriFromBytes(image.bytes, image.mimeType);
    let textX = 0.8; let textW = 4.55; let imageX = 5.35; let imageW = 3.85;
    if (placement === 'left') { textX = 4.8; imageX = 0.8; }
    if (placement === 'supporting') { textW = 5.65; imageX = 6.75; imageW = 2.45; }
    if (fullBleed) { textX = 1.1; textW = 7.8; }
    if (!fullBleed) slide.addImage({ data: imageData, x: imageX, y: placement === 'supporting' ? 3.55 : 1.7, w: imageW, h: placement === 'supporting' ? 1.35 : 3.15 });
    const bodyFit = fitText({ text: bulletText, widthInches: textW, maxHeightInches: fullBleed ? 2.7 : 3.05, preferredFontSize: bodyStyle.preferredFontSize, minFontSize: bodyStyle.minFontSize });
    if (bodyFit.overflow) throw new Error(`Image text bullets overflow at minimum ${bodyStyle.minFontSize}pt`);
    slide.addText(bulletText, { x: textX, y: fullBleed ? 1.8 : 1.72, w: textW, h: Math.max(1.2, bodyFit.estimatedHeight), fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, color: fullBleed ? THEME.title : THEME.body, valign: 'top', fit: 'shrink' });
  });
}
function sourceText(source: Source): string {
  const provenance = [source.author ?? source.organization, source.year === undefined ? undefined : String(source.year)].filter((part): part is string => part !== undefined && part.length > 0).join(', ');
  return `${source.title}${provenance ? ` — ${provenance}` : ''}${source.url ? `\n${source.url}` : ''}`;
}

function renderSourceBlock(slide: PptxSlide, source: Source, index: number, startY: number): { height: number; bottomY: number } {
  const bodyStyle = typographyFor('BODY');
  const text = sourceText(source);
  const fit = fitText({ text, widthInches: 7.55, maxHeightInches: 0.72, preferredFontSize: bodyStyle.preferredFontSize, minFontSize: bodyStyle.minFontSize });
  if (fit.overflow) throw new Error(`Source ${index + 1} overflows at minimum ${bodyStyle.minFontSize}pt`);
  const height = Math.max(0.45, fit.estimatedHeight) + 0.18;
  slide.addText(`[${String(index + 1).padStart(2, '0')}]`, { x: 0.8, y: startY, w: 0.7, h: height, fontFace: typographyFor('LABEL').fontFace, fontSize: typographyFor('LABEL').preferredFontSize, bold: true, color: THEME.accent, valign: 'top' });
  slide.addText(text, { x: 1.65, y: startY, w: 7.55, h: height, fontFace: bodyStyle.fontFace, fontSize: fit.fontSize, color: THEME.body, valign: 'top', fit: 'shrink' });
  return { height, bottomY: startY + height };
}

function renderSourcesSlide(slideData: Slide, pptx: PptxDocument): void {
  if (slideData.visual.needed) throw new Error('Sources layout cannot contain an image');
  if (slideData.cards.length > 0) throw new Error('Sources layout cannot contain content cards');
  if (slideData.sources.length === 0) throw new Error('Sources layout requires supplied sources');
  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  const labelStyle = typographyFor('LABEL');
  const titleStyle = typographyFor('TITLE');
  slide.addText('[ ИСТОЧНИКИ ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  const titleFit = fitText({ text: slideData.title, widthInches: 8.4, maxHeightInches: 0.6, preferredFontSize: titleStyle.preferredFontSize, minFontSize: titleStyle.minFontSize });
  if (titleFit.overflow) throw new Error(`Sources title overflows at minimum ${titleStyle.minFontSize}pt`);
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: 0.03, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  let currentY = 1.65;
  for (const [index, source] of slideData.sources.entries()) currentY = renderSourceBlock(slide, source, index, currentY).bottomY + 0.12;
  if (currentY > 5.05) throw new Error('Sources exceed the safe slide height');
}


function renderConclusionSlide(slideData: Slide, pptx: PptxDocument): void {
  if (slideData.visual.needed) throw new Error('Conclusion layout cannot contain an image');
  if (slideData.cards.length !== 3) throw new Error('Conclusion layout requires exactly three supplied takeaways');
  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  const labelStyle = typographyFor('LABEL');
  const titleStyle = typographyFor('TITLE');
  slide.addText('[ РЕЗЮМЕ ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  const titleFit = fitText({ text: slideData.title, widthInches: 8.4, maxHeightInches: 0.6, preferredFontSize: titleStyle.preferredFontSize, minFontSize: titleStyle.minFontSize });
  if (titleFit.overflow) throw new Error(`Conclusion title overflows at minimum ${titleStyle.minFontSize}pt`);
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: 0.03, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });

  let currentY = 1.65;
  const bodyStyle = typographyFor('BODY');
  const takeawayTitleStyle = typographyFor('BODY', { bold: true });
  for (const [index, card] of slideData.cards.entries()) {
    const titleFitCard = fitText({ text: card.title, widthInches: 7.5, maxHeightInches: 0.35, preferredFontSize: takeawayTitleStyle.preferredFontSize, minFontSize: takeawayTitleStyle.minFontSize });
    const bodyFit = fitText({ text: card.text, widthInches: 7.5, maxHeightInches: 0.62, preferredFontSize: bodyStyle.preferredFontSize, minFontSize: bodyStyle.minFontSize });
    if (titleFitCard.overflow || bodyFit.overflow) throw new Error(`Conclusion takeaway ${index + 1} overflows at readable minimum`);
    const blockHeight = Math.max(0.35, titleFitCard.estimatedHeight) + Math.max(0.35, bodyFit.estimatedHeight) + 0.15;
    slide.addText(String(index + 1).padStart(2, '0'), { x: 0.8, y: currentY, w: 0.7, h: blockHeight, fontFace: titleStyle.fontFace, fontSize: typographyFor('NUMBER').preferredFontSize, bold: true, color: THEME.accent, valign: 'top' });
    slide.addText(card.title, { x: 1.6, y: currentY, w: 7.6, h: Math.max(0.35, titleFitCard.estimatedHeight), fontFace: takeawayTitleStyle.fontFace, fontSize: titleFitCard.fontSize, bold: true, color: THEME.title, valign: 'top', fit: 'shrink' });
    slide.addText(card.text, { x: 1.6, y: currentY + Math.max(0.35, titleFitCard.estimatedHeight) + 0.05, w: 7.6, h: Math.max(0.35, bodyFit.estimatedHeight), fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, color: THEME.body, valign: 'top', fit: 'shrink' });
    currentY += blockHeight + 0.18;
  }
  if (currentY > 5.05) throw new Error('Conclusion exceeds the safe slide height');
}
/** Render only layouts registered in this extraction. */
export async function renderPresentation(presentation: Presentation, options: RenderOptions = {}): Promise<Uint8Array> {
  const unsupported = presentation.slides.find((slide) => !['title', 'sources', 'conclusion', 'definition', 'hero', 'quote', 'image_text'].includes(slide.layout));
  if (unsupported) throw new Error(`Layout not implemented in local renderer: ${unsupported.layout}`);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = presentation.presentation.studentName;
  pptx.subject = presentation.presentation.subject;
  pptx.title = presentation.presentation.displayTitle;
  pptx.company = 'SlideX';
  for (const slide of presentation.slides) {
    if (slide.layout === 'title') renderTitleSlide(presentation, slide, pptx);
    else if (slide.layout === 'sources') renderSourcesSlide(slide, pptx);
    else if (slide.layout === 'conclusion') renderConclusionSlide(slide, pptx);
    else if (slide.layout === 'definition') renderDefinitionSlide(slide, pptx);
    else if (slide.layout === 'hero') renderHeroSlide(slide, pptx);
    else if (slide.layout === 'quote') renderQuoteSlide(slide, pptx);
    else {
      if (!options.imageResolver) throw new Error('Image text layout requires an imageResolver');
      await renderImageTextSlide(slide, pptx, options.imageResolver);
    }
  }
  const output = await pptx.write({ outputType: 'uint8array' });
  if (output instanceof Uint8Array) return output;
  if (output instanceof ArrayBuffer) return new Uint8Array(output);
  throw new Error('PptxGenJS returned an unsupported output type');
}
