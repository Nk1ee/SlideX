import { z } from 'zod';

const text = z.string().refine((value) => value.trim().length > 0, 'Expected non-blank text');
const url = z.url().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), 'Expected HTTP(S) URL');

export const layoutSchema = z.enum([
  'title', 'hero', 'image_text', 'two_column', 'three_cards', 'comparison',
  'timeline', 'statistics', 'process', 'definition', 'quote', 'conclusion', 'sources',
]);

export const themeIdSchema = z.enum([
  'deep_blue',
  'minimal_light',
  'minimal_graphite',
  'dynamic_violet',
  'dynamic_coral',
  'business_slate',
  'business_emerald',
]);

export const userRequestSchema = z.strictObject({
  topic: text, subject: text, studentName: text, group: text,
  slideCount: z.number().int().min(1), style: themeIdSchema,
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
    case 'process': require(slide.steps.length > 0, 'steps', 'Process steps required'); break;
    case 'definition': require(slide.definition !== null, 'definition', 'Definition required'); break;
    case 'quote': require(slide.quote !== null, 'quote', 'Quote required'); break;
    case 'conclusion': require(slide.cards.length === 3, 'cards', 'Three supplied takeaways required'); break;
    case 'sources': require(slide.sources.length > 0, 'sources', 'Sources required'); break;
  }
  if (slide.layout === 'sources' || slide.layout === 'conclusion') {
    require(!slide.visual.needed && slide.visual.type === 'none', 'visual', 'No images on sources or conclusion');
  }
});

export const presentationSchema = z.strictObject({
  chatId: text,
  presentation: z.strictObject({
    fullTopic: text, displayTitle: text, subject: text, studentName: text, group: text,
    slideCount: z.number().int().min(1), style: themeIdSchema, language: z.literal('ru'),
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
