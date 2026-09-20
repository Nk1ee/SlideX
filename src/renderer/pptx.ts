import * as PptxGenJSModule from 'pptxgenjs';
import { fitText } from './fitText.js';
import { typographyFor } from './typography.js';
import type { Presentation, Slide, Source } from '../presentation/types.js';

const THEME = { background: '0A1128', accent: '38BDF8', title: 'FFFFFF', subtitle: 'CBD5E1', body: 'CBD5E1', footer: '64748B' };
type TextOptions = { x: number; y: number; w: number; h: number; fontFace?: string; fontSize?: number; bold?: boolean; color?: string; valign?: 'mid' | 'top'; fit?: 'shrink' };
type ShapeOptions = { x: number; y: number; w: number; h: number; fill: { color: string }; line: { color: string; transparency: number } };
type PptxSlide = { background: { color: string }; addShape: (shape: 'rect', options: ShapeOptions) => void; addText: (text: string, options: TextOptions) => void };
type PptxDocument = { layout: string; author: string; subject: string; title: string; company: string; addSlide: () => PptxSlide; write: (options: { outputType: 'uint8array' }) => Promise<Uint8Array | ArrayBuffer> };
type PptxConstructor = new () => PptxDocument;
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
/** Render only layouts registered in this extraction: title, sources and conclusion. */
export async function renderPresentation(presentation: Presentation): Promise<Uint8Array> {
  const unsupported = presentation.slides.find((slide) => slide.layout !== 'title' && slide.layout !== 'sources' && slide.layout !== 'conclusion');
  if (unsupported) throw new Error(`Layout not implemented in local renderer: ${unsupported.layout}`);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = presentation.presentation.studentName;
  pptx.subject = presentation.presentation.subject;
  pptx.title = presentation.presentation.displayTitle;
  pptx.company = 'SlideX';
  presentation.slides.forEach((slide) => slide.layout === 'title' ? renderTitleSlide(presentation, slide, pptx) : slide.layout === 'sources' ? renderSourcesSlide(slide, pptx) : renderConclusionSlide(slide, pptx));
  const output = await pptx.write({ outputType: 'uint8array' });
  if (output instanceof Uint8Array) return output;
  if (output instanceof ArrayBuffer) return new Uint8Array(output);
  throw new Error('PptxGenJS returned an unsupported output type');
}

