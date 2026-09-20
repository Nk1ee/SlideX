import * as PptxGenJSModule from 'pptxgenjs';
import { fitText } from './fitText.js';
import { typographyFor } from './typography.js';
import type { Presentation, Slide } from '../presentation/types.js';

const THEME = {
  background: '0A1128',
  accent: '38BDF8',
  title: 'FFFFFF',
  subtitle: 'CBD5E1',
};

type TextOptions = { x: number; y: number; w: number; h: number; fontFace?: string; fontSize?: number; bold?: boolean; color?: string; valign?: 'mid' | 'top'; breakLine?: boolean; fit?: 'shrink' };
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
  slide.addText(slideData.title, { x: 1.15, y: 1.25, w: 4.5, h: 1.8, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'mid', breakLine: false, fit: 'shrink' });
  slide.addText(`Предмет: ${presentation.presentation.subject}\nСтудент: ${presentation.presentation.studentName} (Группа ${presentation.presentation.group})`, { x: 1.15, y: 3.25, w: 4.5, h: 0.85, fontFace: typographyFor('SUBTITLE').fontFace, fontSize: typographyFor('SUBTITLE').preferredFontSize, color: THEME.subtitle, breakLine: false, fit: 'shrink' });
}

/** Render only layouts registered in this first extraction: title. */
export async function renderPresentation(presentation: Presentation): Promise<Uint8Array> {
  const unsupported = presentation.slides.find((slide) => slide.layout !== 'title');
  if (unsupported) throw new Error(`Layout not implemented in local renderer: ${unsupported.layout}`);

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = presentation.presentation.studentName;
  pptx.subject = presentation.presentation.subject;
  pptx.title = presentation.presentation.displayTitle;
  pptx.company = 'SlideX';
  presentation.slides.forEach((slide) => renderTitleSlide(presentation, slide, pptx));
  const output = await pptx.write({ outputType: 'uint8array' });
  if (output instanceof Uint8Array) return output;
  if (output instanceof ArrayBuffer) return new Uint8Array(output);
  throw new Error('PptxGenJS returned an unsupported output type');
}


