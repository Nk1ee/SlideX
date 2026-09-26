import { z } from 'zod';

const text = z.string().refine((value) => value.trim().length > 0, 'Expected non-blank text');
const url = z.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Expected HTTP(S) URL');

export const layoutSchema = z.enum([
  'title', 'hero', 'image_text', 'two_column', 'three_cards', 'comparison',
  'timeline', 'statistics', 'chart', 'process', 'definition', 'quote', 'conclusion', 'sources',
]);

export const themeIdSchema = z.enum([
  'deep_blue',
  'minimal_light',
  'minimal_graphite',
  'minimal_sand',
  'dynamic_violet',
  'dynamic_coral',
  'business_slate',
  'business_emerald',
]);

export const educationContextSchema = z.discriminatedUnion('educationStage', [
  z.strictObject({ educationStage: z.literal('school'), schoolClass: text }),
  z.strictObject({ educationStage: z.literal('college'), course: text }),
  z.strictObject({ educationStage: z.literal('university'), course: text }),
]);

export const userRequestSchema = z.strictObject({
  topic: text, subject: text, studentName: text, group: text,
  slideCount: z.number().int().min(1), style: themeIdSchema,
  educationContext: educationContextSchema.optional(),
});

export const sourceSchema = z.strictObject({
  title: text,
  author: text.optional(),
  organization: text.optional(),
  year: z.number().int().min(1).max(9999).optional(),
  url: url.optional(),
}).refine((source) => Boolean(source.url || source.author || source.organization), 'Source needs identifiable provenance');

export const visualSchema = z.strictObject({
  needed: z.boolean(),
  type: z.enum(['none', 'photo', 'illustration', 'diagram']),
  concept: z.string(),
  query_en: z.string(),
  placement: z.enum(['left', 'right', 'full', 'background', 'supporting']),
}).superRefine((visual, ctx) => {
  if (visual.needed && (visual.type === 'none' || !visual.concept.trim() || !visual.query_en.trim())) {
    ctx.addIssue({ code: 'custom', message: 'Requested visual needs type, concept and query_en' });
  }
});

const cardSchema = z.strictObject({ title: text, text });
const columnSchema = z.strictObject({ title: text, items: z.array(text).min(1) });
const statisticSchema = z.strictObject({
  value: text, label: text, description: text, source: sourceSchema.optional(),
});
const chartSeriesSchema = z.strictObject({
  name: text,
  values: z.array(z.number().finite()).min(2).max(8),
});
export const chartSchema = z.strictObject({
  kind: z.enum(['column', 'bar', 'pie', 'doughnut']),
  categories: z.array(text).min(2).max(8),
  series: z.array(chartSeriesSchema).min(1).max(3),
  unit: z.string(),
  source: sourceSchema,
}).superRefine((chart, ctx) => {
  chart.series.forEach((series, index) => {
    if (series.values.length !== chart.categories.length) {
      ctx.addIssue({ code: 'custom', path: ['series', index, 'values'], message: 'Every series must contain one value per category' });
    }
  });
  if (chart.kind === 'pie' || chart.kind === 'doughnut') {
    if (chart.series.length !== 1) ctx.addIssue({ code: 'custom', path: ['series'], message: 'Pie and doughnut charts require exactly one series' });
    const values = chart.series[0]?.values ?? [];
    if (values.some((value) => value < 0)) ctx.addIssue({ code: 'custom', path: ['series', 0, 'values'], message: 'Pie and doughnut charts cannot contain negative values' });
    if (values.length > 0 && values.every((value) => value === 0)) ctx.addIssue({ code: 'custom', path: ['series', 0, 'values'], message: 'Pie and doughnut charts require at least one positive value' });
  }
});

export const slideSchema = z.strictObject({
  number: z.number().int().min(1),
  type: z.enum(['title', 'content', 'conclusion', 'sources']),
  layout: layoutSchema,
  title: text,
  subtitle: z.string(),
  bullets: z.array(text),
  cards: z.array(cardSchema),
  columns: z.array(columnSchema),
  comparison: z.strictObject({ left: columnSchema, right: columnSchema }).nullable(),
  statistics: z.array(statisticSchema).min(1).nullable(),
  chart: chartSchema.nullable(),
  timeline: z.array(z.strictObject({ date: text, title: text, text })),
  steps: z.array(cardSchema),
  definition: z.strictObject({ term: text, text }).nullable(),
  quote: z.strictObject({ text, author: text, source: sourceSchema.optional() }).nullable(),
  visual: visualSchema,
  sources: z.array(sourceSchema),
  repetitionReason: text.optional(),
}).superRefine((slide, ctx) => {
  const require = (condition: boolean, field: string, message: string): void => {
    if (!condition) ctx.addIssue({ code: 'custom', path: [field], message });
  };
  const expectedType = ['title', 'sources', 'conclusion'].includes(slide.layout) ? slide.layout : 'content';
  require(slide.type === expectedType, 'type', 'Slide type must match layout role');
  switch (slide.layout) {
    case 'title': break;
    case 'hero': require(Boolean(slide.subtitle.trim()), 'subtitle', 'Hero needs a supplied statement'); break;
    case 'image_text': require(slide.bullets.length > 0, 'bullets', 'Image/text needs text'); break;
    case 'two_column': require(slide.columns.length === 2, 'columns', 'Exactly two columns required'); break;
    case 'three_cards': require(slide.cards.length === 3, 'cards', 'Exactly three cards required'); break;
    case 'comparison': require(slide.comparison !== null, 'comparison', 'Comparison required'); break;
    case 'timeline': require(slide.timeline.length > 0, 'timeline', 'Timeline required'); break;
    case 'statistics':
      require(slide.statistics !== null, 'statistics', 'Statistics required');
      slide.statistics?.forEach((statistic, index) => {
        if (!statistic.source) ctx.addIssue({ code: 'custom', path: ['statistics', index, 'source'], message: 'Statistics require provenance; no invented values' });
      });
      break;
    case 'chart': require(slide.chart !== null, 'chart', 'Chart data required'); break;
    case 'process': require(slide.steps.length > 0, 'steps', 'Process steps required'); break;
    case 'definition': require(slide.definition !== null, 'definition', 'Definition required'); break;
    case 'quote': require(slide.quote !== null, 'quote', 'Quote required'); break;
    case 'conclusion': require(slide.cards.length === 3, 'cards', 'Three supplied takeaways required'); break;
    case 'sources': require(slide.sources.length > 0, 'sources', 'Sources required'); break;
  }
  if (slide.layout === 'sources' || slide.layout === 'conclusion' || slide.layout === 'chart') {
    require(!slide.visual.needed && slide.visual.type === 'none', 'visual', 'No images on sources or conclusion');
  }
});

export const presentationSchema = z.strictObject({
  chatId: text,
  presentation: z.strictObject({
    fullTopic: text, displayTitle: text, subject: text, studentName: text, group: text,
    slideCount: z.number().int().min(1), style: themeIdSchema, language: z.literal('ru'),
    educationContext: educationContextSchema.optional(),
  }),
  slides: z.array(slideSchema).min(1),
}).superRefine((data, ctx) => {
  if (data.slides.length !== data.presentation.slideCount) {
    ctx.addIssue({ code: 'custom', path: ['slides'], message: 'Exact requested slide count required' });
  }
  data.slides.forEach((slide, index) => {
    if (slide.number !== index + 1) ctx.addIssue({ code: 'custom', path: ['slides', index, 'number'], message: 'Slide numbers must be sequential and unique' });
    if (index >= 2 && slide.layout === data.slides[index - 1]?.layout && slide.layout === data.slides[index - 2]?.layout && !slide.repetitionReason) {
      ctx.addIssue({ code: 'custom', path: ['slides', index, 'layout'], message: 'More than two repeated layouts need a reason' });
    }
  });
});

/**
 * HTTP boundary used by remote renderers.
 * `request` is copied from the trusted FSM state; `payload` is the Gemini result.
 * Keeping them separate lets the validator detect metadata changes by the model.
 */
export const renderRequestSchema = z.strictObject({
  request: userRequestSchema,
  payload: presentationSchema,
});
