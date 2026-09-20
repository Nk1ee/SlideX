export type FitTextOptions = {
  text: string;
  widthInches: number;
  maxHeightInches: number;
  preferredFontSize: number;
  minFontSize: number;
  lineHeightMultiplier?: number;
  averageCharacterWidthFactor?: number;
};

export type FitTextResult = {
  fontSize: number;
  estimatedLines: number;
  estimatedHeight: number;
  overflow: boolean;
};

function countEstimatedLines(text: string, charsPerLine: number): number {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).reduce((total, paragraph) => total + Math.max(1, Math.ceil(paragraph.length / charsPerLine)), 0);
}

/**
 * Estimate text fit for PPTX geometry.
 * It never truncates text. If the minimum readable size still overflows, overflow=true.
 */
export function fitText({
  text,
  widthInches,
  maxHeightInches,
  preferredFontSize,
  minFontSize,
  lineHeightMultiplier = 1.35,
  averageCharacterWidthFactor = 0.007,
}: FitTextOptions): FitTextResult {
  if (widthInches <= 0 || maxHeightInches <= 0) throw new Error('Text box dimensions must be positive');
  if (preferredFontSize <= 0 || minFontSize <= 0 || minFontSize > preferredFontSize) throw new Error('Font sizes must be positive and minFontSize <= preferredFontSize');
  if (lineHeightMultiplier <= 0 || averageCharacterWidthFactor <= 0) throw new Error('Typography factors must be positive');

  let fontSize = preferredFontSize;
  let lastResult: FitTextResult = { fontSize, estimatedLines: 0, estimatedHeight: 0, overflow: false };
  while (fontSize >= minFontSize) {
    const averageCharacterWidth = fontSize * averageCharacterWidthFactor;
    const charsPerLine = Math.max(12, Math.floor(widthInches / averageCharacterWidth));
    const estimatedLines = countEstimatedLines(text, charsPerLine);
    const estimatedHeight = estimatedLines * (fontSize * lineHeightMultiplier / 72);
    lastResult = { fontSize, estimatedLines, estimatedHeight, overflow: estimatedHeight > maxHeightInches };
    if (!lastResult.overflow) return lastResult;
    fontSize -= 0.5;
  }
  return { ...lastResult, fontSize: minFontSize, overflow: true };
}
