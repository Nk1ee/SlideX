import { z } from 'npm:zod@4.6.5';
const nonBlankString = z.string().refine((value) => value.trim().length > 0, 'Expected a non-blank string');
/**
 * A semantic image review. The evaluator reports what it sees; it never edits
 * the slide, creates content, or changes authoritative user metadata.
 */
export const imageAiQualityReportSchema = z.strictObject({
    kind: z.literal('image'),
    decision: z.enum(['accept', 'reject', 'review']),
    confidence: z.enum(['low', 'medium', 'high']),
    relevance: z.enum(['strong', 'partial', 'none', 'uncertain']),
    educationalValue: z.enum(['explains', 'supports', 'decorative', 'misleading', 'uncertain']),
    genericStock: z.boolean(),
    containsText: z.boolean(),
    textEssential: z.boolean(),
    textLegibility: z.enum(['not_applicable', 'readable', 'unreadable', 'unknown']),
    observedElements: z.array(nonBlankString).max(12),
    mismatch: nonBlankString.nullable(),
    reason: nonBlankString,
}).superRefine((report, context) => {
    if (report.decision === 'accept' && report.relevance === 'none') {
        context.addIssue({ code: 'custom', path: ['decision'], message: 'An irrelevant image cannot be accepted' });
    }
    if (report.decision === 'accept' && report.educationalValue === 'misleading') {
        context.addIssue({ code: 'custom', path: ['decision'], message: 'A misleading image cannot be accepted' });
    }
    if (report.decision === 'accept' && !['explains', 'supports'].includes(report.educationalValue)) {
        context.addIssue({ code: 'custom', path: ['educationalValue'], message: 'An accepted image must explain or support the slide' });
    }
    if (report.decision === 'accept' && report.genericStock) {
        context.addIssue({ code: 'custom', path: ['decision'], message: 'Generic stock imagery cannot be accepted' });
    }
    if (!report.containsText && report.textLegibility !== 'not_applicable') {
        context.addIssue({ code: 'custom', path: ['textLegibility'], message: 'Text legibility is not applicable when no text is present' });
    }
    if (!report.containsText && report.textEssential) {
        context.addIssue({ code: 'custom', path: ['textEssential'], message: 'Text cannot be essential when no text is present' });
    }
    if (report.containsText && report.textLegibility === 'not_applicable') {
        context.addIssue({ code: 'custom', path: ['textLegibility'], message: 'Text legibility must be evaluated when text is present' });
    }
    if (report.decision === 'accept' && report.textEssential && report.textLegibility !== 'readable') {
        context.addIssue({ code: 'custom', path: ['decision'], message: 'Essential text must be readable in an accepted image' });
    }
});
const visualCheckSchema = z.enum(['pass', 'fail', 'uncertain', 'not_applicable']);
/** A visual review of a rendered slide PNG. Factual verification is a separate concern. */
export const slideAiQualityReportSchema = z.strictObject({
    kind: z.literal('slide'),
    decision: z.enum(['accept', 'reject', 'review']),
    confidence: z.enum(['low', 'medium', 'high']),
    checks: z.strictObject({
        textReadability: visualCheckSchema,
        overlap: visualCheckSchema,
        clipping: visualCheckSchema,
        contrast: visualCheckSchema,
        hierarchy: visualCheckSchema,
        imageAlignment: visualCheckSchema,
        sourcesReadability: visualCheckSchema,
        conclusionReadability: visualCheckSchema,
    }),
    issues: z.array(z.strictObject({
        code: z.enum([
            'text_unreadable',
            'overlap',
            'clipping',
            'low_contrast',
            'weak_hierarchy',
            'image_mismatch',
            'sources_unreadable',
            'conclusion_unreadable',
            'other',
        ]),
        severity: z.enum(['warning', 'error']),
        evidence: nonBlankString,
    })).max(20),
    reason: nonBlankString,
}).superRefine((report, context) => {
    for (const check of ['textReadability', 'overlap', 'clipping', 'contrast', 'hierarchy']) {
        if (report.checks[check] === 'not_applicable') {
            context.addIssue({ code: 'custom', path: ['checks', check], message: `${check} applies to every rendered slide` });
        }
    }
    const hasUnresolvedCheck = Object.values(report.checks).some((check) => check === 'fail' || check === 'uncertain');
    const hasError = report.issues.some((issue) => issue.severity === 'error');
    if (report.decision === 'accept' && (hasUnresolvedCheck || hasError)) {
        context.addIssue({ code: 'custom', path: ['decision'], message: 'A slide with unresolved checks or errors cannot be accepted' });
    }
});
/** Checks that layout-specific findings match the actual canonical slide role. */
export function assertSlideAiReportContext(report, slide) {
    const expectedImage = slide.visual.needed;
    const expectedSources = slide.layout === 'sources';
    const expectedConclusion = slide.layout === 'conclusion';
    for (const [check, expected] of [
        ['imageAlignment', expectedImage],
        ['sourcesReadability', expectedSources],
        ['conclusionReadability', expectedConclusion],
    ]) {
        const value = report.checks[check];
        if ((value === 'not_applicable') === expected) {
            throw new Error(`${check} does not match slide layout`);
        }
    }
}
