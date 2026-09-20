import JSZip from 'jszip';

export type PptxValidationOptions = { expectedSlideCount?: number; imagesExpected?: boolean };
export type PptxValidationReport = { ok: boolean; slideCount: number; entries: string[]; issues: string[] };

/** Validate the PPTX ZIP container and basic slide structure after rendering. */
export async function validatePptxBinary(binary: Uint8Array, options: PptxValidationOptions = {}): Promise<PptxValidationReport> {
  const issues: string[] = [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(binary);
  } catch {
    return { ok: false, slideCount: 0, entries: [], issues: ['PPTX is not a readable ZIP archive'] };
  }
  const entries = Object.keys(zip.files);
  if (!entries.includes('[Content_Types].xml')) issues.push('Missing [Content_Types].xml');
  if (!entries.some((entry) => entry === 'ppt/')) issues.push('Missing ppt/ directory');
  if (!entries.some((entry) => entry === 'ppt/slides/')) issues.push('Missing ppt/slides/ directory');
  const slideEntries = entries.filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry)).sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]));
  if (options.expectedSlideCount !== undefined && slideEntries.length !== options.expectedSlideCount) issues.push(`Expected ${options.expectedSlideCount} slides, found ${slideEntries.length}`);
  for (const entry of slideEntries) {
    const xml = await zip.file(entry)!.async('text');
    if (!xml.includes('<p:sld') || !xml.includes('<p:spTree')) issues.push(`${entry} is missing required slide XML`);
    if (!xml.includes('<a:t>') && !xml.includes('<p:pic')) issues.push(`${entry} appears empty`);
  }
  const mediaEntries = entries.filter((entry) => entry.startsWith('ppt/media/'));
  if (options.imagesExpected === true && mediaEntries.length === 0) issues.push('Images were expected but ppt/media/ is empty');
  return { ok: issues.length === 0, slideCount: slideEntries.length, entries, issues };
}

export async function assertValidPptx(binary: Uint8Array, options: PptxValidationOptions = {}): Promise<void> {
  const report = await validatePptxBinary(binary, options);
  if (!report.ok) throw new Error(report.issues.join('; '));
}
