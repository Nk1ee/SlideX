import * as PptxGenJSModule from 'pptxgenjs';
import { fitText } from './fitText.js';
import { typographyFor } from './typography.js';
import type { Presentation, Slide, Source } from '../presentation/types.js';
import { getPresentationTheme, type ThemeColors, type ThemeGeometry } from '../presentation/themes.js';
import type { ImageCandidate } from '../images/types.js';
import { imageDataUriFromBytes } from '../images/dedupe.js';

type TextOptions = { x: number; y: number; w: number; h: number; fontFace?: string; fontSize?: number; bold?: boolean; italic?: boolean; color?: string; valign?: 'mid' | 'top'; fit?: 'shrink'; hyperlink?: { url: string } };
type ShapeOptions = { x: number; y: number; w: number; h: number; fill: { color: string; transparency?: number }; line: { color: string; transparency: number } };
type ImageOptions = { data: string; x: number; y: number; w: number; h: number; altText?: string; sizing?: { type: 'cover'; w: number; h: number } };
type PptxSlide = { background: { color: string }; addShape: (shape: 'rect' | 'parallelogram', options: ShapeOptions) => void; addText: (text: string, options: TextOptions) => void; addImage: (options: ImageOptions) => void; addNotes: (notes: string) => void };
type PptxDocument = { layout: string; author: string; subject: string; title: string; company: string; addSlide: () => PptxSlide; write: (options: { outputType: 'uint8array' }) => Promise<Uint8Array | ArrayBuffer> };
type PptxConstructor = new () => PptxDocument;
type RenderTheme = ThemeColors & ThemeGeometry;
export type ImageResolver = (slide: Slide) => Promise<ImageCandidate | null>;
export type RenderOptions = { imageResolver?: ImageResolver };
const PptxGenJS = ((PptxGenJSModule as unknown as { default?: PptxConstructor }).default ?? PptxGenJSModule) as unknown as PptxConstructor;

function renderTitleSlide(presentation: Presentation, slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  if (THEME.titleMotif !== 'none') {
    const energetic = THEME.titleMotif === 'energetic';
    const motif = [
      { x: energetic ? 7.25 : 7.65, w: energetic ? 1.45 : 1.1, transparency: energetic ? 54 : 76 },
      { x: energetic ? 8.55 : 8.75, w: energetic ? 1.45 : 1.1, transparency: energetic ? 12 : 8 },
    ];
    for (const band of motif) {
      slide.addShape('parallelogram', {
        x: band.x, y: 0, w: band.w, h: 5.625,
        fill: { color: THEME.accent, transparency: band.transparency },
        line: { color: THEME.accent, transparency: 100 },
      });
    }
  }
  const titleStyle = typographyFor('COVER_TITLE');
  const titleFit = fitText({ text: slideData.title, widthInches: 5.3, maxHeightInches: 2.4, preferredFontSize: titleStyle.preferredFontSize, minFontSize: titleStyle.minFontSize });
  if (titleFit.overflow) throw new Error(`Title overflows at minimum ${titleStyle.minFontSize}pt`);
  slide.addShape('rect', { x: 0.8, y: 3.58, w: THEME.titleRuleWidth, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  slide.addText(slideData.title, { x: 0.8, y: 1.05, w: 5.3, h: 2.4, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'mid', fit: 'shrink' });
  const subtitleStyle = typographyFor('SUBTITLE');
  slide.addText(`Предмет: ${presentation.presentation.subject}\nСтудент: ${presentation.presentation.studentName} (Группа ${presentation.presentation.group})`, { x: 0.8, y: 3.88, w: 5.3, h: 0.85, fontFace: subtitleStyle.fontFace, fontSize: subtitleStyle.preferredFontSize, color: THEME.subtitle, fit: 'shrink' });
}



function renderHeroSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
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
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  const thesisFit = fitText({ text: slideData.subtitle, widthInches: 7.8, maxHeightInches: 1.7, preferredFontSize: heroStyle.preferredFontSize, minFontSize: heroStyle.minFontSize });
  if (thesisFit.overflow) throw new Error(`Hero thesis overflows at minimum ${heroStyle.minFontSize}pt`);
  slide.addText(slideData.subtitle, { x: 0.8, y: 1.95, w: 7.8, h: Math.max(1.1, thesisFit.estimatedHeight), fontFace: heroStyle.fontFace, fontSize: thesisFit.fontSize, bold: heroStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
}
function renderDefinitionSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
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
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  const termFit = fitText({ text: slideData.definition.term, widthInches: 8.0, maxHeightInches: 0.8, preferredFontSize: termStyle.preferredFontSize, minFontSize: termStyle.minFontSize });
  const bodyFit = fitText({ text: slideData.definition.text, widthInches: 8.0, maxHeightInches: 2.1, preferredFontSize: bodyStyle.preferredFontSize, minFontSize: bodyStyle.minFontSize });
  if (termFit.overflow || bodyFit.overflow) throw new Error('Definition content overflows at readable minimum');
  slide.addText(slideData.definition.term, { x: 0.8, y: 1.75, w: 8.0, h: Math.max(0.8, termFit.estimatedHeight), fontFace: termStyle.fontFace, fontSize: termFit.fontSize, bold: termStyle.bold, color: THEME.accent, valign: 'top', fit: 'shrink' });
  slide.addText(slideData.definition.text, { x: 0.8, y: 2.75, w: 8.0, h: Math.max(1.0, bodyFit.estimatedHeight), fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, color: THEME.body, valign: 'top', fit: 'shrink' });
}
function renderQuoteSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
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
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  const quoteFit = fitText({ text: slideData.quote.text, widthInches: 7.7, maxHeightInches: 1.65, preferredFontSize: quoteStyle.preferredFontSize, minFontSize: quoteStyle.minFontSize });
  if (quoteFit.overflow) throw new Error(`Quote text overflows at minimum ${quoteStyle.minFontSize}pt`);
  slide.addText('“', { x: 0.78, y: 1.72, w: 0.45, h: 0.7, fontFace: quoteStyle.fontFace, fontSize: 42, bold: true, color: THEME.accent, valign: 'top' });
  slide.addText(slideData.quote.text, { x: 1.35, y: 1.78, w: 7.7, h: Math.max(1.1, quoteFit.estimatedHeight), fontFace: quoteStyle.fontFace, fontSize: quoteFit.fontSize, italic: true, color: THEME.title, valign: 'top', fit: 'shrink' });
  const attribution = `— ${slideData.quote.author}${slideData.quote.source ? `\n${sourceText(slideData.quote.source)}` : ''}`;
  const attributionFit = fitText({ text: attribution, widthInches: 7.7, maxHeightInches: 0.8, preferredFontSize: bodyStyle.preferredFontSize, minFontSize: bodyStyle.minFontSize });
  if (attributionFit.overflow) throw new Error(`Quote attribution overflows at minimum ${bodyStyle.minFontSize}pt`);
  slide.addText(attribution, { x: 1.35, y: 3.72, w: 7.7, h: Math.max(0.55, attributionFit.estimatedHeight), fontFace: bodyStyle.fontFace, fontSize: attributionFit.fontSize, color: THEME.subtitle, valign: 'top', fit: 'shrink' });
}

type RenderedBlock = { height: number; bottomY: number };

function renderTwoColumnBlock(
  slide: PptxSlide,
  column: Slide['columns'][number],
  columnIndex: number,
  x: number,
  width: number,
  startY: number,
  safeBottomY: number,
  THEME: RenderTheme,
): RenderedBlock {
  const headingStyle = typographyFor('SUBTITLE', { bold: true });
  const bodyStyle = typographyFor('BODY');
  const headingFit = fitText({
    text: column.title,
    widthInches: width,
    maxHeightInches: 0.72,
    preferredFontSize: headingStyle.preferredFontSize,
    minFontSize: headingStyle.minFontSize,
  });
  if (headingFit.overflow) throw new Error(`Two-column heading ${columnIndex + 1} overflows at readable minimum`);

  const headingHeight = Math.max(0.38, headingFit.estimatedHeight);
  const bodyY = startY + headingHeight + 0.18;
  const bodyText = column.items.map((item) => `• ${item}`).join('\n\n');
  const bodyFit = fitText({
    text: bodyText,
    widthInches: width,
    maxHeightInches: safeBottomY - bodyY,
    preferredFontSize: bodyStyle.preferredFontSize,
    minFontSize: bodyStyle.minFontSize,
  });
  if (bodyFit.overflow) throw new Error(`Two-column content ${columnIndex + 1} overflows at readable minimum`);

  const bodyHeight = Math.max(0.72, bodyFit.estimatedHeight + 0.04);
  const bottomY = bodyY + bodyHeight;
  if (bottomY > safeBottomY) throw new Error(`Two-column content ${columnIndex + 1} exceeds the safe slide height`);

  slide.addText(column.title, {
    x, y: startY, w: width, h: headingHeight,
    fontFace: headingStyle.fontFace, fontSize: headingFit.fontSize, bold: headingStyle.bold,
    color: THEME.title, valign: 'top', fit: 'shrink',
  });
  slide.addText(bodyText, {
    x, y: bodyY, w: width, h: bodyHeight,
    fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, bold: bodyStyle.bold,
    color: THEME.body, valign: 'top', fit: 'shrink',
  });
  return { height: bottomY - startY, bottomY };
}

function renderTwoColumnSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
  if (slideData.visual.needed) throw new Error('Two-column layout cannot contain an image');
  if (slideData.columns.length !== 2) throw new Error('Two-column layout requires exactly two supplied columns');
  for (const [index, column] of slideData.columns.entries()) {
    if (!column.title.trim() || column.items.length === 0) throw new Error(`Two-column column ${index + 1} requires a title and supplied items`);
  }

  const titleStyle = typographyFor('TITLE');
  const titleFit = fitText({
    text: slideData.title,
    widthInches: 8.4,
    maxHeightInches: 0.6,
    preferredFontSize: titleStyle.preferredFontSize,
    minFontSize: titleStyle.minFontSize,
  });
  if (titleFit.overflow) throw new Error(`Two-column title overflows at minimum ${titleStyle.minFontSize}pt`);

  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  // Both rules separate real content regions and are added before text to preserve z-order.
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  slide.addShape('rect', { x: 4.965, y: 1.7, w: Math.max(0.025, THEME.dividerHeight), h: 3.25, fill: { color: THEME.accent, transparency: 55 }, line: { color: THEME.accent, transparency: 100 } });

  const labelStyle = typographyFor('LABEL');
  slide.addText('[ ДВА АСПЕКТА ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });

  const positions = [0.8, 5.25] as const;
  for (const [index, column] of slideData.columns.entries()) {
    renderTwoColumnBlock(slide, column, index, positions[index]!, 3.75, 1.72, 5.0, THEME);
  }
}

function renderThreeCardBlock(
  slide: PptxSlide,
  card: Slide['cards'][number],
  cardIndex: number,
  x: number,
  width: number,
  startY: number,
  safeBottomY: number,
  THEME: RenderTheme,
): RenderedBlock {
  const numberStyle = typographyFor('NUMBER', { preferredFontSize: 28, minFontSize: 26 });
  const headingStyle = typographyFor('SUBTITLE', { bold: true });
  const bodyStyle = typographyFor('BODY');
  const titleY = startY + 0.68;
  const titleFit = fitText({
    text: card.title,
    widthInches: width,
    maxHeightInches: 0.78,
    preferredFontSize: headingStyle.preferredFontSize,
    minFontSize: headingStyle.minFontSize,
  });
  if (titleFit.overflow) throw new Error(`Three-cards title ${cardIndex + 1} overflows at readable minimum`);

  const titleHeight = Math.max(0.42, titleFit.estimatedHeight);
  const bodyY = titleY + titleHeight + 0.16;
  const bodyFit = fitText({
    text: card.text,
    widthInches: width,
    maxHeightInches: safeBottomY - bodyY,
    preferredFontSize: bodyStyle.preferredFontSize,
    minFontSize: bodyStyle.minFontSize,
  });
  if (bodyFit.overflow) throw new Error(`Three-cards text ${cardIndex + 1} overflows at readable minimum`);

  const bodyHeight = Math.max(0.72, bodyFit.estimatedHeight + 0.04);
  const bottomY = bodyY + bodyHeight;
  if (bottomY > safeBottomY) throw new Error(`Three-cards content ${cardIndex + 1} exceeds the safe slide height`);

  slide.addText(String(cardIndex + 1).padStart(2, '0'), {
    x, y: startY + 0.12, w: width, h: 0.45,
    fontFace: numberStyle.fontFace, fontSize: numberStyle.preferredFontSize, bold: numberStyle.bold,
    color: THEME.accent, valign: 'top',
  });
  slide.addText(card.title, {
    x, y: titleY, w: width, h: titleHeight,
    fontFace: headingStyle.fontFace, fontSize: titleFit.fontSize, bold: headingStyle.bold,
    color: THEME.title, valign: 'top', fit: 'shrink',
  });
  slide.addText(card.text, {
    x, y: bodyY, w: width, h: bodyHeight,
    fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, bold: bodyStyle.bold,
    color: THEME.body, valign: 'top', fit: 'shrink',
  });
  return { height: bottomY - startY, bottomY };
}

function renderThreeCardsSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
  if (slideData.visual.needed) throw new Error('Three-cards layout cannot contain an image');
  if (slideData.cards.length !== 3) throw new Error('Three-cards layout requires exactly three supplied cards');
  for (const [index, card] of slideData.cards.entries()) {
    if (!card.title.trim() || !card.text.trim()) throw new Error(`Three-cards card ${index + 1} requires supplied title and text`);
  }

  const titleStyle = typographyFor('TITLE');
  const titleFit = fitText({
    text: slideData.title,
    widthInches: 8.4,
    maxHeightInches: 0.6,
    preferredFontSize: titleStyle.preferredFontSize,
    minFontSize: titleStyle.minFontSize,
  });
  if (titleFit.overflow) throw new Error(`Three-cards slide title overflows at minimum ${titleStyle.minFontSize}pt`);

  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  const positions = [0.8, 3.725, 6.65] as const;
  for (const x of positions) {
    slide.addShape('rect', { x, y: 1.72, w: 2.55, h: Math.max(0.025, THEME.dividerHeight), fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  }

  const labelStyle = typographyFor('LABEL');
  slide.addText('[ ТРИ АСПЕКТА ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
  for (const [index, card] of slideData.cards.entries()) {
    renderThreeCardBlock(slide, card, index, positions[index]!, 2.55, 1.72, 5.0, THEME);
  }
}

function renderImageTextSlide(slideData: Slide, pptx: PptxDocument, imageResolver: (slide: Slide) => Promise<ImageCandidate | null>, THEME: RenderTheme): void | Promise<void> {
  if (!slideData.visual.needed) throw new Error('Image text layout requires visual.needed=true');
  return imageResolver(slideData).then((image) => {
    if (image === null) throw new Error('Image text layout requires a resolved relevant image; switch layout when search fails');
    if (!image.bytes || image.bytes.byteLength === 0) throw new Error('Resolved image has no downloaded bytes');
    if (!image.author?.trim() || !image.license?.trim() || !image.sourceUrl) throw new Error('Resolved image has no attribution metadata');
    if (image.provider === 'unsplash' && !image.authorUrl) throw new Error('Unsplash photographer profile is missing');
    if (!['image/jpeg', 'image/png'].includes(image.mimeType)) throw new Error(`Unsupported image MIME type: ${image.mimeType}`);
    const slide = pptx.addSlide();
    slide.background = { color: THEME.background };
    const placement = slideData.visual.placement;
    const fullBleed = placement === 'full' || placement === 'background';
    if (slideData.visual.type === 'diagram' && fullBleed) throw new Error('Diagram requires a contained image placement');
    if (fullBleed) {
      slide.addImage({ data: imageDataUriFromBytes(image.bytes, image.mimeType), x: 0, y: 0, w: 10, h: 5.625, altText: image.altText, sizing: { type: 'cover', w: 10, h: 5.625 } });
      slide.addShape('rect', { x: 0, y: 0, w: 10, h: 5.625, fill: { color: THEME.background, transparency: 28 }, line: { color: THEME.background, transparency: 100 } });
    }
    const labelStyle = typographyFor('LABEL');
    const titleStyle = typographyFor('TITLE');
    const bodyStyle = typographyFor('BODY');
    slide.addText('[ ВИЗУАЛЬНЫЙ КОНТЕКСТ ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
    const titleFit = fitText({ text: slideData.title, widthInches: 8.4, maxHeightInches: 0.6, preferredFontSize: titleStyle.preferredFontSize, minFontSize: titleStyle.minFontSize });
    if (titleFit.overflow) throw new Error(`Image text title overflows at minimum ${titleStyle.minFontSize}pt`);
    slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
    if (!fullBleed) slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
    const bulletText = slideData.bullets.map((bullet) => `• ${bullet}`).join('\n');
    const imageData = imageDataUriFromBytes(image.bytes, image.mimeType);
    let textX = 0.8; let textW = 4.55; let imageX = 5.35; let imageW = 3.85;
    if (placement === 'left') { textX = 4.8; imageX = 0.8; }
    if (placement === 'supporting') { textW = 5.65; imageX = 6.75; imageW = 2.45; }
    if (fullBleed) { textX = 1.1; textW = 7.8; }
    if (!fullBleed) {
      const imageY = placement === 'supporting' ? 2.65 : 1.7;
      const imageH = placement === 'supporting' ? 2.2 : 3.15;
      if (slideData.visual.type === 'diagram') {
        const padding = 0.12;
        const availableW = imageW - padding * 2;
        const availableH = imageH - padding * 2;
        const scale = Math.min(availableW / image.width, availableH / image.height);
        const renderedW = image.width * scale;
        const renderedH = image.height * scale;
        slide.addShape('rect', { x: imageX, y: imageY, w: imageW, h: imageH, fill: { color: 'FFFFFF' }, line: { color: 'FFFFFF', transparency: 100 } });
        slide.addImage({ data: imageData, x: imageX + (imageW - renderedW) / 2, y: imageY + (imageH - renderedH) / 2, w: renderedW, h: renderedH, altText: image.altText });
      } else {
        slide.addImage({ data: imageData, x: imageX, y: imageY, w: imageW, h: imageH, altText: image.altText, sizing: { type: 'cover', w: imageW, h: imageH } });
      }
    }
    const bodyFit = fitText({ text: bulletText, widthInches: textW, maxHeightInches: fullBleed ? 2.7 : 3.05, preferredFontSize: bodyStyle.preferredFontSize, minFontSize: bodyStyle.minFontSize });
    if (bodyFit.overflow) throw new Error(`Image text bullets overflow at minimum ${bodyStyle.minFontSize}pt`);
    slide.addText(bulletText, { x: textX, y: fullBleed ? 1.8 : 1.72, w: textW, h: Math.max(1.2, bodyFit.estimatedHeight), fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, color: fullBleed ? THEME.title : THEME.body, valign: 'top', fit: 'shrink' });
    const captionStyle = typographyFor('CAPTION');
    const shortPublicDomainCredit = image.provider === 'wikimedia' && (image.license === 'CC0' || image.license === 'Public domain') && image.author.length > 80;
    const credit = 'Изображение: ' + (shortPublicDomainCredit ? 'Wikimedia Commons' : image.author) + ' · ' + image.license + (image.provider === 'unsplash' ? ' · Unsplash' : '');
    slide.addNotes('Изображение: ' + image.author + '. Источник: ' + image.sourceUrl + '. Лицензия: ' + image.license + (image.licenseUrl ? ' (' + image.licenseUrl + ')' : '') + (image.authorUrl ? '. Автор: ' + image.authorUrl : '') + (slideData.visual.type === 'diagram' ? '. Отображение: без кадрирования.' : '. Отображение: кадрирование под формат слайда.'));
    const creditFit = fitText({ text: credit, widthInches: 8.4, maxHeightInches: 0.42, preferredFontSize: captionStyle.preferredFontSize, minFontSize: captionStyle.minFontSize });
    if (creditFit.overflow) throw new Error('Image attribution overflows at readable minimum');
    slide.addText(credit, { x: 0.8, y: 5.03, w: 8.4, h: 0.42, fontFace: captionStyle.fontFace, fontSize: creditFit.fontSize, color: THEME.subtitle, hyperlink: { url: image.authorUrl ?? image.sourceUrl } });
  });
}
function sourceText(source: Source): string {
  const provenance = [source.author ?? source.organization, source.year === undefined ? undefined : String(source.year)].filter((part): part is string => part !== undefined && part.length > 0).join(', ');
  return `${source.title}${provenance ? ` — ${provenance}` : ''}${source.url ? `\n${source.url}` : ''}`;
}

function renderSourceBlock(slide: PptxSlide, source: Source, index: number, startY: number, THEME: RenderTheme): { height: number; bottomY: number } {
  const bodyStyle = typographyFor('BODY');
  const labelStyle = typographyFor('LABEL');
  const captionStyle = typographyFor('CAPTION');
  const provenance = [source.author ?? source.organization, source.year === undefined ? undefined : String(source.year)].filter((part): part is string => part !== undefined && part.length > 0).join(', ');
  const titleFit = fitText({ text: source.title, widthInches: 7.55, maxHeightInches: 0.66, preferredFontSize: bodyStyle.preferredFontSize, minFontSize: bodyStyle.minFontSize });
  const provenanceFit = provenance ? fitText({ text: provenance, widthInches: 7.55, maxHeightInches: 0.42, preferredFontSize: labelStyle.preferredFontSize, minFontSize: labelStyle.minFontSize }) : null;
  const urlFit = source.url ? fitText({ text: source.url, widthInches: 7.55, maxHeightInches: 0.44, preferredFontSize: captionStyle.preferredFontSize, minFontSize: captionStyle.minFontSize }) : null;
  if (titleFit.overflow || provenanceFit?.overflow || urlFit?.overflow) throw new Error(`Source ${index + 1} overflows at readable minimum`);
  let currentY = startY;
  const titleHeight = titleFit.estimatedHeight + 0.06;
  slide.addText(source.title, { x: 1.65, y: currentY, w: 7.55, h: titleHeight, fontFace: bodyStyle.fontFace, fontSize: titleFit.fontSize, bold: true, color: THEME.title, valign: 'top' });
  currentY += titleHeight + 0.02;
  if (provenanceFit) {
    const height = provenanceFit.estimatedHeight + 0.03;
    slide.addText(provenance, { x: 1.65, y: currentY, w: 7.55, h: height, fontFace: labelStyle.fontFace, fontSize: provenanceFit.fontSize, color: THEME.body, valign: 'top' });
    currentY += height + 0.02;
  }
  if (urlFit && source.url) {
    const height = urlFit.estimatedHeight + 0.03;
    slide.addText(source.url, { x: 1.65, y: currentY, w: 7.55, h: height, fontFace: captionStyle.fontFace, fontSize: urlFit.fontSize, color: THEME.accent, valign: 'top', hyperlink: { url: source.url } });
    currentY += height;
  }
  const blockHeight = currentY - startY;
  slide.addText(`[${String(index + 1).padStart(2, '0')}]`, { x: 0.8, y: startY, w: 0.7, h: blockHeight, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: true, color: THEME.accent, valign: 'top' });
  return { height: blockHeight, bottomY: currentY };
}
function renderSourcesSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
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
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  let currentY = 1.65;
  for (const [index, source] of slideData.sources.entries()) currentY = renderSourceBlock(slide, source, index, currentY, THEME).bottomY + 0.12;
  if (currentY > 5.05) throw new Error('Sources exceed the safe slide height');
}


function renderConclusionSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
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
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });

  let currentY = 1.65;
  const bodyStyle = typographyFor('BODY');
  const takeawayTitleStyle = typographyFor('BODY', { bold: true });
  for (const [index, card] of slideData.cards.entries()) {
    const titleFitCard = fitText({ text: card.title, widthInches: 7.5, maxHeightInches: 0.35, preferredFontSize: takeawayTitleStyle.preferredFontSize, minFontSize: takeawayTitleStyle.minFontSize });
    const bodyFit = fitText({ text: card.text, widthInches: 7.5, maxHeightInches: 0.62, preferredFontSize: bodyStyle.preferredFontSize, minFontSize: bodyStyle.minFontSize });
    if (titleFitCard.overflow || bodyFit.overflow) throw new Error(`Conclusion takeaway ${index + 1} overflows at readable minimum`);
    const blockHeight = Math.max(0.35, titleFitCard.estimatedHeight) + Math.max(0.35, bodyFit.estimatedHeight) + 0.15;
    slide.addText(String(index + 1).padStart(2, '0'), { x: 0.8, y: currentY, w: 0.95, h: blockHeight, fontFace: titleStyle.fontFace, fontSize: typographyFor('NUMBER').preferredFontSize, bold: true, color: THEME.accent, valign: 'top' });
    slide.addText(card.title, { x: 1.95, y: currentY, w: 7.25, h: Math.max(0.35, titleFitCard.estimatedHeight), fontFace: takeawayTitleStyle.fontFace, fontSize: titleFitCard.fontSize, bold: true, color: THEME.title, valign: 'top', fit: 'shrink' });
    slide.addText(card.text, { x: 1.95, y: currentY + Math.max(0.35, titleFitCard.estimatedHeight) + 0.05, w: 7.25, h: Math.max(0.35, bodyFit.estimatedHeight), fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, color: THEME.body, valign: 'top', fit: 'shrink' });
    currentY += blockHeight + 0.18;
  }
  if (currentY > 5.05) throw new Error('Conclusion exceeds the safe slide height');
}
/** Render only layouts registered in this extraction. */
export async function renderPresentation(presentation: Presentation, options: RenderOptions = {}): Promise<Uint8Array> {
  const unsupported = presentation.slides.find((slide) => !['title', 'sources', 'conclusion', 'definition', 'hero', 'quote', 'two_column', 'three_cards', 'image_text'].includes(slide.layout));
  if (unsupported) throw new Error(`Layout not implemented in local renderer: ${unsupported.layout}`);
  const selectedTheme = getPresentationTheme(presentation.presentation.style);
  const THEME: RenderTheme = { ...selectedTheme.colors, ...selectedTheme.geometry };
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = presentation.presentation.studentName;
  pptx.subject = presentation.presentation.subject;
  pptx.title = presentation.presentation.displayTitle;
  pptx.company = 'SlideX';
  for (const slide of presentation.slides) {
    if (slide.layout === 'title') renderTitleSlide(presentation, slide, pptx, THEME);
    else if (slide.layout === 'sources') renderSourcesSlide(slide, pptx, THEME);
    else if (slide.layout === 'conclusion') renderConclusionSlide(slide, pptx, THEME);
    else if (slide.layout === 'definition') renderDefinitionSlide(slide, pptx, THEME);
    else if (slide.layout === 'hero') renderHeroSlide(slide, pptx, THEME);
    else if (slide.layout === 'quote') renderQuoteSlide(slide, pptx, THEME);
    else if (slide.layout === 'two_column') renderTwoColumnSlide(slide, pptx, THEME);
    else if (slide.layout === 'three_cards') renderThreeCardsSlide(slide, pptx, THEME);
    else {
      if (!options.imageResolver) throw new Error('Image text layout requires an imageResolver');
      await renderImageTextSlide(slide, pptx, options.imageResolver, THEME);
    }
  }
  const output = await pptx.write({ outputType: 'uint8array' });
  if (output instanceof Uint8Array) return output;
  if (output instanceof ArrayBuffer) return new Uint8Array(output);
  throw new Error('PptxGenJS returned an unsupported output type');
}
