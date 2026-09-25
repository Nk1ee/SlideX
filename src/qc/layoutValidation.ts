import type { Layout, Presentation } from '../presentation/types.js';
import type { QualityIssue, QualityReport } from './contentValidation.js';

function issue(code: string, path: string, message: string): QualityIssue { return { code, path, message }; }

/** Plan-only gate. It does not decide whether a layout is aesthetically good. */
export function validateLayoutPlan(presentation: Presentation, implementedLayouts: ReadonlySet<Layout>): QualityReport {
  const issues: QualityIssue[] = [];
  if (presentation.slides[0]?.layout !== 'title') issues.push(issue('first_slide_not_title', 'slides[0].layout', 'The first slide must use title layout'));
  presentation.slides.forEach((slide, index) => {
    const path = `slides[${index}]`;
    if (!implementedLayouts.has(slide.layout)) issues.push(issue('layout_not_implemented', `${path}.layout`, `No renderer registered for ${slide.layout}`));
    if ((slide.layout === 'sources' || slide.layout === 'conclusion') && slide.visual.needed) issues.push(issue('final_layout_has_image', `${path}.visual`, `${slide.layout} must not request an image`));
    if (slide.layout === 'two_column' && slide.visual.needed) issues.push(issue('two_column_has_image', `${path}.visual`, 'two_column must use supplied columns without an image'));
    if (slide.layout === 'three_cards' && slide.visual.needed) issues.push(issue('three_cards_has_image', `${path}.visual`, 'three_cards must use supplied cards without an image'));
    if (slide.layout === 'comparison' && slide.visual.needed) issues.push(issue('comparison_has_image', `${path}.visual`, 'comparison must use supplied sides without an image'));
    if (slide.layout === 'timeline' && slide.visual.needed) issues.push(issue('timeline_has_image', `${path}.visual`, 'timeline must use supplied dated entries without an image'));
    if (slide.layout === 'process' && slide.visual.needed) issues.push(issue('process_has_image', `${path}.visual`, 'process must use supplied steps without an image'));
    if (slide.layout === 'statistics' && slide.visual.needed) issues.push(issue('statistics_has_image', `${path}.visual`, 'statistics must use supplied indicators and sources without an image'));
    if (slide.layout === 'sources' && slide.cards.length > 0) issues.push(issue('sources_has_cards', `${path}.cards`, 'Sources should be an editorial list without content cards'));
    if (index >= 2 && slide.layout === presentation.slides[index - 1]?.layout && slide.layout === presentation.slides[index - 2]?.layout && !slide.repetitionReason) issues.push(issue('layout_repeated', `${path}.layout`, 'More than two repeated layouts require an explicit reason'));
  });
  return { ok: issues.length === 0, issues };
}

export function assertLayoutPlan(presentation: Presentation, implementedLayouts: ReadonlySet<Layout>): void {
  const report = validateLayoutPlan(presentation, implementedLayouts);
  if (!report.ok) throw new Error(report.issues.map((item) => `${item.path}: ${item.message}`).join('; '));
}
