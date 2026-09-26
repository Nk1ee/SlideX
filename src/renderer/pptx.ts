import * as PptxGenJSModule from 'pptxgenjs';
import { fitText } from './fitText.js';
import { typographyFor } from './typography.js';
import type { Presentation, Slide, Source } from '../presentation/types.js';
import { getPresentationTheme, type ThemeColors, type ThemeGeometry } from '../presentation/themes.js';
import type { ImageCandidate } from '../images/types.js';
import { imageDataUriFromBytes } from '../images/dedupe.js';

type TextOptions = { x: number; y: number; w: number; h: number; fontFace?: string; fontSize?: number; bold?: boolean; italic?: boolean; color?: string; align?: 'left' | 'center' | 'right'; valign?: 'mid' | 'top'; fit?: 'shrink'; hyperlink?: { url: string } };
type ShapeOptions = { x: number; y: number; w: number; h: number; fill: { color: string; transparency?: number }; line: { color: string; transparency: number } };
type ImageOptions = { data: string; x: number; y: number; w: number; h: number; altText?: string; sizing?: { type: 'cover'; w: number; h: number } };
type ChartSeries = { name: string; labels: string[]; values: number[] };
type ChartOptions = {
  x: number; y: number; w: number; h: number; chartColors: string[];
  showLegend: boolean; legendPos: 'b' | 'r'; legendColor: string; legendFontFace: string; legendFontSize: number;
  showValue: boolean; showPercent: boolean; showLabel: boolean; showLeaderLines: boolean; dataLabelColor: string; dataLabelFontFace: string; dataLabelFontSize: number; dataLabelPosition: 'bestFit' | 'outEnd';
  catAxisLabelColor?: string; catAxisLabelFontFace?: string; catAxisLabelFontSize?: number; catAxisLineColor?: string;
  valAxisLabelColor?: string; valAxisLabelFontFace?: string; valAxisLabelFontSize?: number; valAxisLineColor?: string;
  valGridLine?: { color: string; transparency: number }; barDir?: 'col' | 'bar'; barGrouping?: 'clustered'; barGapWidthPct?: number; holeSize?: number;
  chartArea: { fill: { color: string; transparency: number }; border: { color: string; transparency: number } };
  plotArea: { fill: { color: string; transparency: number }; border: { color: string; transparency: number } };
  altText: string;
};
type PptxSlide = { background: { color: string }; addShape: (shape: 'rect' | 'parallelogram' | 'ellipse', options: ShapeOptions) => void; addText: (text: string, options: TextOptions) => void; addImage: (options: ImageOptions) => void; addChart: (type: 'bar' | 'pie' | 'doughnut', data: ChartSeries[], options: ChartOptions) => void; addNotes: (notes: string) => void };
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
  const education = presentation.presentation.educationContext;
  const authorLine = education?.educationStage === 'school'
    ? `Ученик: ${presentation.presentation.studentName} (Класс ${education.schoolClass})`
    : education?.educationStage === 'college' || education?.educationStage === 'university'
      ? `Студент: ${presentation.presentation.studentName} (Группа ${presentation.presentation.group}, курс ${education.course})`
      : `Студент: ${presentation.presentation.studentName} (Группа ${presentation.presentation.group})`;
  slide.addText(`Предмет: ${presentation.presentation.subject}\n${authorLine}`, { x: 0.8, y: 3.88, w: 5.3, h: 0.85, fontFace: subtitleStyle.fontFace, fontSize: subtitleStyle.preferredFontSize, color: THEME.subtitle, fit: 'shrink' });
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

function renderComparisonSide(
  slide: PptxSlide,
  side: NonNullable<Slide['comparison']>['left'],
  sideName: 'left' | 'right',
  x: number,
  width: number,
  startY: number,
  safeBottomY: number,
  THEME: RenderTheme,
): RenderedBlock {
  const headingStyle = typographyFor('SUBTITLE', { bold: true });
  const bodyStyle = typographyFor('BODY');
  const headingFit = fitText({
    text: side.title,
    widthInches: width - 0.36,
    maxHeightInches: 0.68,
    preferredFontSize: headingStyle.preferredFontSize,
    minFontSize: headingStyle.minFontSize,
  });
  if (headingFit.overflow) throw new Error(`Comparison ${sideName} heading overflows at readable minimum`);

  const headingHeight = Math.max(0.4, headingFit.estimatedHeight);
  const bodyY = startY + 0.22 + headingHeight + 0.18;
  const bodyText = side.items.map((item) => `• ${item}`).join('\n\n');
  const bodyFit = fitText({
    text: bodyText,
    widthInches: width - 0.36,
    maxHeightInches: safeBottomY - bodyY - 0.04,
    preferredFontSize: bodyStyle.preferredFontSize,
    minFontSize: bodyStyle.minFontSize,
  });
  if (bodyFit.overflow) throw new Error(`Comparison ${sideName} items overflow at readable minimum`);

  const bodyHeight = Math.max(0.72, bodyFit.estimatedHeight + 0.04);
  const bottomY = bodyY + bodyHeight;
  if (bottomY > safeBottomY) throw new Error(`Comparison ${sideName} content exceeds the safe slide height`);

  slide.addText(side.title, {
    x: x + 0.18, y: startY + 0.2, w: width - 0.36, h: headingHeight,
    fontFace: headingStyle.fontFace, fontSize: headingFit.fontSize, bold: headingStyle.bold,
    color: THEME.title, valign: 'top', fit: 'shrink',
  });
  slide.addText(bodyText, {
    x: x + 0.18, y: bodyY, w: width - 0.36, h: bodyHeight,
    fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, bold: bodyStyle.bold,
    color: THEME.body, valign: 'top', fit: 'shrink',
  });
  return { height: bottomY - startY, bottomY };
}

function renderComparisonSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
  if (slideData.visual.needed) throw new Error('Comparison layout cannot contain an image');
  if (slideData.comparison === null) throw new Error('Comparison layout requires supplied left and right sides');
  for (const [name, side] of [['left', slideData.comparison.left], ['right', slideData.comparison.right]] as const) {
    if (!side.title.trim() || side.items.length === 0) throw new Error(`Comparison ${name} side requires a title and supplied items`);
  }

  const titleStyle = typographyFor('TITLE');
  const titleFit = fitText({
    text: slideData.title,
    widthInches: 8.4,
    maxHeightInches: 0.6,
    preferredFontSize: titleStyle.preferredFontSize,
    minFontSize: titleStyle.minFontSize,
  });
  if (titleFit.overflow) throw new Error(`Comparison title overflows at minimum ${titleStyle.minFontSize}pt`);

  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  slide.addShape('rect', { x: 0.8, y: 1.72, w: 3.78, h: 0.82, fill: { color: THEME.accent, transparency: 86 }, line: { color: THEME.accent, transparency: 100 } });
  slide.addShape('rect', { x: 5.42, y: 1.72, w: 3.78, h: 0.82, fill: { color: THEME.accent, transparency: 86 }, line: { color: THEME.accent, transparency: 100 } });
  slide.addShape('ellipse', { x: 4.7, y: 2.0, w: 0.6, h: 0.6, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });

  const labelStyle = typographyFor('LABEL');
  slide.addText('[ СРАВНЕНИЕ ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
  slide.addText('VS', { x: 4.7, y: 2.14, w: 0.6, h: 0.22, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: true, color: THEME.background, valign: 'mid' });
  renderComparisonSide(slide, slideData.comparison.left, 'left', 0.8, 3.78, 1.72, 5.0, THEME);
  renderComparisonSide(slide, slideData.comparison.right, 'right', 5.42, 3.78, 1.72, 5.0, THEME);
}

function renderTimelineEntry(
  slide: PptxSlide,
  entry: Slide['timeline'][number],
  entryIndex: number,
  x: number,
  width: number,
  nodeY: number,
  safeBottomY: number,
  THEME: RenderTheme,
): RenderedBlock {
  const dateStyle = typographyFor('BODY', { bold: true });
  const headingStyle = typographyFor('SUBTITLE', { bold: true });
  const bodyStyle = typographyFor('BODY');
  const dateFit = fitText({
    text: entry.date,
    widthInches: width,
    maxHeightInches: 0.42,
    preferredFontSize: dateStyle.preferredFontSize,
    minFontSize: dateStyle.minFontSize,
  });
  const titleFit = fitText({
    text: entry.title,
    widthInches: width,
    maxHeightInches: 0.72,
    preferredFontSize: headingStyle.preferredFontSize,
    minFontSize: headingStyle.minFontSize,
  });
  if (dateFit.overflow || titleFit.overflow) throw new Error(`Timeline entry ${entryIndex + 1} heading overflows at readable minimum`);

  const titleY = nodeY + 0.42;
  const titleHeight = Math.max(0.42, titleFit.estimatedHeight);
  const bodyY = titleY + titleHeight + 0.14;
  const bodyFit = fitText({
    text: entry.text,
    widthInches: width,
    maxHeightInches: safeBottomY - bodyY - 0.04,
    preferredFontSize: bodyStyle.preferredFontSize,
    minFontSize: bodyStyle.minFontSize,
  });
  if (bodyFit.overflow) throw new Error(`Timeline entry ${entryIndex + 1} text overflows at readable minimum`);

  const bodyHeight = Math.max(0.72, bodyFit.estimatedHeight + 0.04);
  const bottomY = bodyY + bodyHeight;
  if (bottomY > safeBottomY) throw new Error(`Timeline entry ${entryIndex + 1} exceeds the safe slide height`);

  slide.addText(entry.date, {
    x, y: nodeY - 0.58, w: width, h: 0.42,
    fontFace: dateStyle.fontFace, fontSize: dateFit.fontSize, bold: dateStyle.bold,
    color: THEME.accent, align: 'center', valign: 'mid', fit: 'shrink',
  });
  slide.addText(entry.title, {
    x, y: titleY, w: width, h: titleHeight,
    fontFace: headingStyle.fontFace, fontSize: titleFit.fontSize, bold: headingStyle.bold,
    color: THEME.title, valign: 'top', fit: 'shrink',
  });
  slide.addText(entry.text, {
    x, y: bodyY, w: width, h: bodyHeight,
    fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, bold: bodyStyle.bold,
    color: THEME.body, valign: 'top', fit: 'shrink',
  });
  return { height: bottomY - (nodeY - 0.58), bottomY };
}

function renderTimelineSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
  if (slideData.visual.needed) throw new Error('Timeline layout cannot contain an image');
  if (slideData.timeline.length === 0) throw new Error('Timeline layout requires supplied dated entries');
  if (slideData.timeline.length > 4) throw new Error('Timeline layout supports at most four entries at readable size');

  const titleStyle = typographyFor('TITLE');
  const titleFit = fitText({
    text: slideData.title,
    widthInches: 8.4,
    maxHeightInches: 0.6,
    preferredFontSize: titleStyle.preferredFontSize,
    minFontSize: titleStyle.minFontSize,
  });
  if (titleFit.overflow) throw new Error(`Timeline title overflows at minimum ${titleStyle.minFontSize}pt`);

  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  const count = slideData.timeline.length;
  const gap = count === 1 ? 0 : 0.28;
  const blockWidth = count === 1 ? 5.8 : (8.4 - gap * (count - 1)) / count;
  const startX = count === 1 ? 2.1 : 0.8;
  const positions = slideData.timeline.map((_, index) => startX + index * (blockWidth + gap));
  const nodeY = 2.2;
  const centers = positions.map((x) => x + blockWidth / 2);

  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  if (centers.length > 1) {
    slide.addShape('rect', { x: centers[0]!, y: nodeY + 0.075, w: centers.at(-1)! - centers[0]!, h: Math.max(0.025, THEME.dividerHeight), fill: { color: THEME.accent, transparency: 45 }, line: { color: THEME.accent, transparency: 100 } });
  }
  for (const center of centers) {
    slide.addShape('ellipse', { x: center - 0.09, y: nodeY, w: 0.18, h: 0.18, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  }

  const labelStyle = typographyFor('LABEL');
  slide.addText('[ ХРОНОЛОГИЯ ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
  for (const [index, entry] of slideData.timeline.entries()) {
    renderTimelineEntry(slide, entry, index, positions[index]!, blockWidth, nodeY, 5.0, THEME);
  }
}

type MeasuredProcessStep = {
  step: Slide['steps'][number];
  titleFit: ReturnType<typeof fitText>;
  bodyFit: ReturnType<typeof fitText>;
  titleHeight: number;
  bodyHeight: number;
  height: number;
};

function measureProcessStep(step: Slide['steps'][number], stepIndex: number, width: number, maxHeight: number): MeasuredProcessStep {
  const titleStyle = typographyFor('BODY', { bold: true });
  const bodyStyle = typographyFor('BODY');
  const titleFit = fitText({
    text: step.title,
    widthInches: width,
    maxHeightInches: Math.min(0.52, maxHeight * 0.44),
    preferredFontSize: titleStyle.preferredFontSize,
    minFontSize: titleStyle.minFontSize,
  });
  if (titleFit.overflow) throw new Error(`Process step ${stepIndex + 1} title overflows at readable minimum`);
  const titleHeight = Math.max(0.28, titleFit.estimatedHeight);
  const bodyMaxHeight = maxHeight - titleHeight - 0.06;
  if (bodyMaxHeight <= 0) throw new Error(`Process step ${stepIndex + 1} has no readable body space`);
  const bodyFit = fitText({
    text: step.text,
    widthInches: width,
    maxHeightInches: bodyMaxHeight - 0.02,
    preferredFontSize: bodyStyle.preferredFontSize,
    minFontSize: bodyStyle.minFontSize,
  });
  if (bodyFit.overflow) throw new Error(`Process step ${stepIndex + 1} text overflows at readable minimum`);
  const bodyHeight = Math.max(0.3, bodyFit.estimatedHeight + 0.02);
  const height = titleHeight + 0.06 + bodyHeight;
  if (height > maxHeight) throw new Error(`Process step ${stepIndex + 1} exceeds its readable height`);
  return { step, titleFit, bodyFit, titleHeight, bodyHeight, height };
}

function renderProcessSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
  if (slideData.visual.needed) throw new Error('Process layout cannot contain an image');
  if (slideData.steps.length === 0) throw new Error('Process layout requires supplied steps');
  if (slideData.steps.length > 4) throw new Error('Process layout supports at most four steps at readable size');
  for (const [index, step] of slideData.steps.entries()) {
    if (!step.title.trim() || !step.text.trim()) throw new Error(`Process step ${index + 1} requires supplied title and text`);
  }

  const titleStyle = typographyFor('TITLE');
  const titleFit = fitText({
    text: slideData.title,
    widthInches: 8.4,
    maxHeightInches: 0.6,
    preferredFontSize: titleStyle.preferredFontSize,
    minFontSize: titleStyle.minFontSize,
  });
  if (titleFit.overflow) throw new Error(`Process title overflows at minimum ${titleStyle.minFontSize}pt`);

  const startY = 1.62;
  const safeBottomY = 5.25;
  const gap = 0.1;
  const availableHeight = safeBottomY - startY - gap * (slideData.steps.length - 1);
  const maxStepHeight = availableHeight / slideData.steps.length;
  const textX = 1.55;
  const textWidth = 7.65;
  const measured = slideData.steps.map((step, index) => measureProcessStep(step, index, textWidth, maxStepHeight));
  const placements: Array<{ block: MeasuredProcessStep; y: number; nodeY: number }> = [];
  let currentY = startY;
  for (const block of measured) {
    const nodeY = currentY + Math.max(0, (block.height - 0.46) / 2);
    placements.push({ block, y: currentY, nodeY });
    currentY += block.height + gap;
  }
  if (currentY - gap > safeBottomY) throw new Error('Process exceeds the safe slide height');

  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  if (placements.length > 1) {
    const firstCenter = placements[0]!.nodeY + 0.23;
    const lastCenter = placements.at(-1)!.nodeY + 0.23;
    slide.addShape('rect', { x: 1.015, y: firstCenter, w: Math.max(0.025, THEME.dividerHeight), h: lastCenter - firstCenter, fill: { color: THEME.accent, transparency: 45 }, line: { color: THEME.accent, transparency: 100 } });
  }
  for (const placement of placements) {
    slide.addShape('ellipse', { x: 0.8, y: placement.nodeY, w: 0.46, h: 0.46, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  }

  const labelStyle = typographyFor('LABEL');
  const stepTitleStyle = typographyFor('BODY', { bold: true });
  const bodyStyle = typographyFor('BODY');
  slide.addText('[ ПРОЦЕСС ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
  for (const [index, placement] of placements.entries()) {
    const { block, y, nodeY } = placement;
    slide.addText(String(index + 1), { x: 0.8, y: nodeY + 0.12, w: 0.46, h: 0.2, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: true, color: THEME.background, align: 'center', valign: 'mid' });
    slide.addText(block.step.title, { x: textX, y, w: textWidth, h: block.titleHeight, fontFace: stepTitleStyle.fontFace, fontSize: block.titleFit.fontSize, bold: stepTitleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
    slide.addText(block.step.text, { x: textX, y: y + block.titleHeight + 0.06, w: textWidth, h: block.bodyHeight, fontFace: bodyStyle.fontFace, fontSize: block.bodyFit.fontSize, bold: bodyStyle.bold, color: THEME.body, valign: 'top', fit: 'shrink' });
  }
}

type MeasuredStatistic = {
  statistic: NonNullable<Slide['statistics']>[number];
  valueFit: ReturnType<typeof fitText>;
  labelFit: ReturnType<typeof fitText>;
  descriptionFit: ReturnType<typeof fitText>;
  sourceFit: ReturnType<typeof fitText>;
  labelHeight: number;
  descriptionHeight: number;
  sourceHeight: number;
  sourceLabel: string;
};

function compactSourceText(source: Source): string {
  const provenance = [source.author ?? source.organization, source.year === undefined ? undefined : String(source.year)]
    .filter((part): part is string => part !== undefined && part.length > 0)
    .join(', ');
  return `${source.title}${provenance ? ` — ${provenance}` : ''}`;
}

function measureStatistic(
  statistic: NonNullable<Slide['statistics']>[number],
  statisticIndex: number,
  rowHeight: number,
): MeasuredStatistic {
  if (!statistic.source) throw new Error(`Statistic ${statisticIndex + 1} requires a supplied source`);
  const numberStyle = typographyFor('NUMBER');
  const labelStyle = typographyFor('BODY', { bold: true });
  const bodyStyle = typographyFor('BODY');
  const captionStyle = typographyFor('CAPTION');
  const valueFit = fitText({
    text: statistic.value,
    widthInches: 2.0,
    maxHeightInches: rowHeight - 0.18,
    preferredFontSize: numberStyle.preferredFontSize,
    minFontSize: numberStyle.minFontSize,
  });
  const labelFit = fitText({
    text: statistic.label,
    widthInches: 6.05,
    maxHeightInches: 0.34,
    preferredFontSize: labelStyle.preferredFontSize,
    minFontSize: labelStyle.minFontSize,
  });
  const labelHeight = Math.max(0.27, labelFit.estimatedHeight);
  const sourceLabel = compactSourceText(statistic.source);
  const sourceFit = fitText({
    text: `[00] ${sourceLabel}`,
    widthInches: 6.05,
    maxHeightInches: 0.24,
    preferredFontSize: captionStyle.preferredFontSize,
    minFontSize: captionStyle.minFontSize,
  });
  const sourceHeight = Math.max(0.18, sourceFit.estimatedHeight);
  const descriptionMaxHeight = rowHeight - 0.12 - labelHeight - 0.04 - sourceHeight - 0.04;
  if (descriptionMaxHeight <= 0) throw new Error(`Statistic ${statisticIndex + 1} has no readable description space`);
  const descriptionFit = fitText({
    text: statistic.description,
    widthInches: 6.05,
    maxHeightInches: descriptionMaxHeight,
    preferredFontSize: bodyStyle.preferredFontSize,
    minFontSize: bodyStyle.minFontSize,
  });
  const descriptionHeight = Math.max(0.28, descriptionFit.estimatedHeight);
  if (valueFit.overflow) throw new Error(`Statistic ${statisticIndex + 1} value overflows at readable minimum`);
  if (labelFit.overflow) throw new Error(`Statistic ${statisticIndex + 1} label overflows at readable minimum`);
  if (descriptionFit.overflow) throw new Error(`Statistic ${statisticIndex + 1} description overflows at readable minimum`);
  if (sourceFit.overflow) throw new Error(`Statistic ${statisticIndex + 1} source overflows at readable minimum`);
  return { statistic, valueFit, labelFit, descriptionFit, sourceFit, labelHeight, descriptionHeight, sourceHeight, sourceLabel };
}

function renderStatisticsSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
  if (slideData.visual.needed) throw new Error('Statistics layout cannot contain an image');
  if (slideData.statistics === null || slideData.statistics.length === 0) throw new Error('Statistics layout requires supplied statistics');
  if (slideData.statistics.length > 3) throw new Error('Statistics layout supports at most three statistics at readable size');

  const titleStyle = typographyFor('TITLE');
  const titleFit = fitText({
    text: slideData.title,
    widthInches: 8.4,
    maxHeightInches: 0.6,
    preferredFontSize: titleStyle.preferredFontSize,
    minFontSize: titleStyle.minFontSize,
  });
  if (titleFit.overflow) throw new Error(`Statistics title overflows at minimum ${titleStyle.minFontSize}pt`);

  const startY = 1.55;
  const safeBottomY = 5.45;
  const gap = 0.1;
  const rowHeight = (safeBottomY - startY - gap * (slideData.statistics.length - 1)) / slideData.statistics.length;
  const measured = slideData.statistics.map((statistic, index) => measureStatistic(statistic, index, rowHeight));

  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  for (let index = 0; index < measured.length; index += 1) {
    const y = startY + index * (rowHeight + gap);
    slide.addShape('rect', { x: 0.8, y, w: 8.4, h: Math.max(0.025, THEME.dividerHeight), fill: { color: THEME.accent, transparency: index === 0 ? 0 : 55 }, line: { color: THEME.accent, transparency: 100 } });
  }

  const labelStyle = typographyFor('LABEL');
  const numberStyle = typographyFor('NUMBER');
  const statisticLabelStyle = typographyFor('BODY', { bold: true });
  const bodyStyle = typographyFor('BODY');
  const captionStyle = typographyFor('CAPTION');
  slide.addText('[ ДАННЫЕ И ИСТОЧНИКИ ]', { x: 0.8, y: 0.4, w: 8.4, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });

  for (const [index, block] of measured.entries()) {
    const rowY = startY + index * (rowHeight + gap);
    const contentY = rowY + 0.12;
    const valueHeight = Math.max(0.46, block.valueFit.estimatedHeight);
    const valueY = rowY + Math.max(0.1, (rowHeight - valueHeight) / 2);
    slide.addText(block.statistic.value, {
      x: 0.8, y: valueY, w: 2.0, h: valueHeight,
      fontFace: numberStyle.fontFace, fontSize: block.valueFit.fontSize, bold: numberStyle.bold,
      color: THEME.accent, valign: 'mid', fit: 'shrink',
    });
    slide.addText(block.statistic.label, {
      x: 3.15, y: contentY, w: 6.05, h: block.labelHeight,
      fontFace: statisticLabelStyle.fontFace, fontSize: block.labelFit.fontSize, bold: statisticLabelStyle.bold,
      color: THEME.title, valign: 'top', fit: 'shrink',
    });
    const descriptionY = contentY + block.labelHeight + 0.04;
    slide.addText(block.statistic.description, {
      x: 3.15, y: descriptionY, w: 6.05, h: block.descriptionHeight,
      fontFace: bodyStyle.fontFace, fontSize: block.descriptionFit.fontSize, bold: bodyStyle.bold,
      color: THEME.body, valign: 'top', fit: 'shrink',
    });
    slide.addText(`[${String(index + 1).padStart(2, '0')}] ${block.sourceLabel}`, {
      x: 3.15, y: descriptionY + block.descriptionHeight + 0.04, w: 6.05, h: block.sourceHeight,
      fontFace: captionStyle.fontFace, fontSize: block.sourceFit.fontSize, color: THEME.subtitle,
      valign: 'top', fit: 'shrink', ...(block.statistic.source?.url ? { hyperlink: { url: block.statistic.source.url } } : {}),
    });
  }
  slide.addNotes(measured.map((block, index) => `[${String(index + 1).padStart(2, '0')}] ${sourceText(block.statistic.source!)}`).join('\n\n'));
}

function renderChartSlide(slideData: Slide, pptx: PptxDocument, THEME: RenderTheme): void {
  if (slideData.visual.needed) throw new Error('Chart layout cannot contain an image');
  if (slideData.chart === null) throw new Error('Chart layout requires supplied chart data');
  const chart = slideData.chart;
  const titleStyle = typographyFor('TITLE');
  const labelStyle = typographyFor('LABEL');
  const captionStyle = typographyFor('CAPTION');
  const titleFit = fitText({ text: slideData.title, widthInches: 8.4, maxHeightInches: 0.6, preferredFontSize: titleStyle.preferredFontSize, minFontSize: titleStyle.minFontSize });
  if (titleFit.overflow) throw new Error(`Chart title overflows at minimum ${titleStyle.minFontSize}pt`);
  const visibleSource = compactSourceText(chart.source);
  const sourceFit = fitText({ text: visibleSource, widthInches: 7.2, maxHeightInches: 0.25, preferredFontSize: captionStyle.preferredFontSize, minFontSize: captionStyle.minFontSize });
  if (sourceFit.overflow) throw new Error('Chart source overflows at readable minimum');

  const circular = chart.kind === 'pie' || chart.kind === 'doughnut';
  const pptxType: 'bar' | 'pie' | 'doughnut' = chart.kind === 'column' || chart.kind === 'bar' ? 'bar' : chart.kind;
  const data: ChartSeries[] = chart.series.map((series) => ({ name: series.name, labels: [...chart.categories], values: [...series.values] }));
  const chartColors = [THEME.accent, THEME.title, THEME.subtitle];
  const chartOptions: ChartOptions = {
    x: 0.8, y: 1.58, w: 8.4, h: 3.38,
    chartColors,
    showLegend: circular || chart.series.length > 1,
    legendPos: circular ? 'r' : 'b', legendColor: THEME.body, legendFontFace: captionStyle.fontFace, legendFontSize: 10,
    showValue: true, showPercent: false, showLabel: circular, showLeaderLines: circular,
    dataLabelColor: chart.kind === 'doughnut' ? THEME.background : THEME.title, dataLabelFontFace: captionStyle.fontFace, dataLabelFontSize: 10,
    dataLabelPosition: chart.kind === 'doughnut' ? 'bestFit' : 'outEnd',
    catAxisLabelColor: THEME.body, catAxisLabelFontFace: captionStyle.fontFace, catAxisLabelFontSize: 11, catAxisLineColor: THEME.subtitle,
    valAxisLabelColor: THEME.body, valAxisLabelFontFace: captionStyle.fontFace, valAxisLabelFontSize: 10, valAxisLineColor: THEME.subtitle,
    valGridLine: { color: THEME.subtitle, transparency: 72 },
    ...(chart.kind === 'column' ? { barDir: 'col' as const, barGrouping: 'clustered' as const, barGapWidthPct: 65 } : {}),
    ...(chart.kind === 'bar' ? { barDir: 'bar' as const, barGrouping: 'clustered' as const, barGapWidthPct: 55 } : {}),
    ...(chart.kind === 'doughnut' ? { holeSize: 38 } : {}),
    chartArea: { fill: { color: THEME.background, transparency: 100 }, border: { color: THEME.background, transparency: 100 } },
    plotArea: { fill: { color: THEME.background, transparency: 100 }, border: { color: THEME.background, transparency: 100 } },
    altText: `${slideData.title}. ${chart.categories.join(', ')}.`,
  };

  const slide = pptx.addSlide();
  slide.background = { color: THEME.background };
  slide.addShape('rect', { x: 0.8, y: 1.35, w: 8.4, h: THEME.dividerHeight, fill: { color: THEME.accent }, line: { color: THEME.accent, transparency: 100 } });
  slide.addChart(pptxType, data, chartOptions);
  slide.addText('[ ДИАГРАММА ]', { x: 0.8, y: 0.4, w: 5.7, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.accent });
  slide.addText(slideData.title, { x: 0.8, y: 0.65, w: 8.4, h: 0.6, fontFace: titleStyle.fontFace, fontSize: titleFit.fontSize, bold: titleStyle.bold, color: THEME.title, valign: 'top', fit: 'shrink' });
  if (chart.unit.trim()) slide.addText(`Единица: ${chart.unit}`, { x: 6.2, y: 0.4, w: 3.0, h: 0.25, fontFace: labelStyle.fontFace, fontSize: labelStyle.preferredFontSize, bold: labelStyle.bold, color: THEME.subtitle, align: 'right' });
  slide.addText(`Источник: ${visibleSource}`, { x: 0.8, y: 5.08, w: 8.4, h: 0.25, fontFace: captionStyle.fontFace, fontSize: sourceFit.fontSize, color: THEME.subtitle, ...(chart.source.url ? { hyperlink: { url: chart.source.url } } : {}) });
  slide.addNotes(`Данные диаграммы. Источник: ${sourceText(chart.source)}`);
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
    const blockHeight = Math.max(0.35, titleFitCard.estimatedHeight) + Math.max(0.35, bodyFit.estimatedHeight) + 0.08;
    slide.addText(String(index + 1).padStart(2, '0'), { x: 0.8, y: currentY, w: 0.95, h: blockHeight, fontFace: titleStyle.fontFace, fontSize: typographyFor('NUMBER').preferredFontSize, bold: true, color: THEME.accent, valign: 'top' });
    slide.addText(card.title, { x: 1.95, y: currentY, w: 7.25, h: Math.max(0.35, titleFitCard.estimatedHeight), fontFace: takeawayTitleStyle.fontFace, fontSize: titleFitCard.fontSize, bold: true, color: THEME.title, valign: 'top', fit: 'shrink' });
    slide.addText(card.text, { x: 1.95, y: currentY + Math.max(0.35, titleFitCard.estimatedHeight) + 0.04, w: 7.25, h: Math.max(0.35, bodyFit.estimatedHeight), fontFace: bodyStyle.fontFace, fontSize: bodyFit.fontSize, color: THEME.body, valign: 'top', fit: 'shrink' });
    currentY += blockHeight + 0.1;
  }
  if (currentY > 5.1) throw new Error('Conclusion exceeds the safe slide height');
}
/** Render only layouts registered in this extraction. */
export async function renderPresentation(presentation: Presentation, options: RenderOptions = {}): Promise<Uint8Array> {
  const unsupported = presentation.slides.find((slide) => !['title', 'sources', 'conclusion', 'definition', 'hero', 'quote', 'two_column', 'three_cards', 'comparison', 'timeline', 'statistics', 'chart', 'process', 'image_text'].includes(slide.layout));
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
    else if (slide.layout === 'comparison') renderComparisonSlide(slide, pptx, THEME);
    else if (slide.layout === 'timeline') renderTimelineSlide(slide, pptx, THEME);
    else if (slide.layout === 'statistics') renderStatisticsSlide(slide, pptx, THEME);
    else if (slide.layout === 'chart') renderChartSlide(slide, pptx, THEME);
    else if (slide.layout === 'process') renderProcessSlide(slide, pptx, THEME);
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
