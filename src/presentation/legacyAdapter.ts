import { userRequestSchema } from './schema.js';
import type { Presentation, UserRequest } from './types.js';
import { validatePresentation } from './validator.js';

export class LegacyAdaptationError extends Error {
  public constructor(message: string) { super(message); this.name = 'LegacyAdaptationError'; }
}

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);
function requiredRecord(value: unknown, path: string): RecordValue { if (!isRecord(value)) throw new LegacyAdaptationError(`${path} must be an object`); return value; }
function stringValue(value: unknown, path: string): string { if (typeof value !== 'string') throw new LegacyAdaptationError(`${path} must be a string`); return value; }
function stringArray(value: unknown, path: string): string[] { if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new LegacyAdaptationError(`${path} must be an array of strings`); return value; }

/** Convert the frozen n8n/Val Town wire shape explicitly; never invent missing content. */
export function adaptLegacyPayload(input: unknown, trustedRequest: unknown): Presentation {
  const request: UserRequest = userRequestSchema.parse(trustedRequest);
  const root = requiredRecord(input, 'payload');
  const legacyMeta = requiredRecord(root.presentation, 'presentation');
  if (!Array.isArray(root.slides)) throw new LegacyAdaptationError('slides must be an array');

  const slides = root.slides.map((rawSlide, index) => {
    const source = requiredRecord(rawSlide, `slides[${index}]`);
    const visual = isRecord(source.visual) ? source.visual : {};
    const needed = visual.needed === true;
    if (needed && typeof visual.type !== 'string') throw new LegacyAdaptationError(`slides[${index}].visual.type is missing; legacy cannot prove the visual kind`);
    const cards = Array.isArray(source.cards) ? source.cards.map((card, cardIndex) => {
      const item = requiredRecord(card, `slides[${index}].cards[${cardIndex}]`);
      return { title: stringValue(item.title, `slides[${index}].cards[${cardIndex}].title`), text: stringValue(item.description ?? item.text, `slides[${index}].cards[${cardIndex}].description`) };
    }) : [];
    const comparison = isRecord(source.comparison) ? {
      left: { title: stringValue(source.comparison.leftTitle, `slides[${index}].comparison.leftTitle`), items: stringArray(source.comparison.leftItems, `slides[${index}].comparison.leftItems`) },
      right: { title: stringValue(source.comparison.rightTitle, `slides[${index}].comparison.rightTitle`), items: stringArray(source.comparison.rightItems, `slides[${index}].comparison.rightItems`) },
    } : null;
    const statistics = source.statistics === undefined || source.statistics === null ? null : Array.isArray(source.statistics) ? source.statistics : [source.statistics];
    if (statistics?.some((item) => !isRecord(item) || !isRecord(item.source))) throw new LegacyAdaptationError(`slides[${index}].statistics has no explicit source; refusing an unverified statistic`);
    const timeline = Array.isArray(source.timeline) ? source.timeline.map((item, timelineIndex) => {
      const event = requiredRecord(item, `slides[${index}].timeline[${timelineIndex}]`);
      return { date: stringValue(event.date, `slides[${index}].timeline[${timelineIndex}].date`), title: stringValue(event.title, `slides[${index}].timeline[${timelineIndex}].title`), text: stringValue(event.description ?? event.text, `slides[${index}].timeline[${timelineIndex}].description`) };
    }) : [];
    const layout = stringValue(source.layout, `slides[${index}].layout`).toLowerCase();
    if (source.quote !== null && source.quote !== undefined) throw new LegacyAdaptationError(`slides[${index}].quote cannot be recovered from frozen Parse Structure output`);
    if (source.definition !== null && source.definition !== undefined) throw new LegacyAdaptationError(`slides[${index}].definition cannot be recovered from frozen Parse Structure output`);
    const rawSources = source.sources ?? [];
    if (!Array.isArray(rawSources) || rawSources.some((item) => typeof item === 'string')) throw new LegacyAdaptationError(`slides[${index}].sources contains plain strings; provenance cannot be reconstructed`);
    return {
      number: index + 1, type: layout === 'title' || layout === 'sources' || layout === 'conclusion' ? layout : 'content', layout,
      title: stringValue(source.title, `slides[${index}].title`), subtitle: typeof source.subtitle === 'string' ? source.subtitle : '',
      bullets: source.bullets === undefined ? [] : stringArray(source.bullets, `slides[${index}].bullets`), cards, columns: [], comparison,
      statistics, timeline, steps: [], definition: null, quote: null,
      visual: { needed, type: needed ? visual.type : 'none', concept: typeof visual.concept === 'string' ? visual.concept : '', query_en: typeof visual.query_en === 'string' ? visual.query_en : '', placement: visual.placement === 'left' ? 'left' : 'right' },
      sources: rawSources,
    };
  });
  return validatePresentation({ chatId: stringValue(root.chatId, 'chatId'), presentation: {
    fullTopic: request.topic, displayTitle: stringValue(legacyMeta.title, 'presentation.title'), subject: request.subject, studentName: request.studentName, group: request.group, slideCount: request.slideCount, style: request.style, language: 'ru',
  }, slides }, request);
}

