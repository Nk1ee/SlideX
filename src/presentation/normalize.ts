import type { Presentation, Slide, Source } from './types.js';

/**
 * Normalize AI-authored presentation text without inventing or deleting meaning.
 * User metadata and statistic values are deliberately left untouched.
 */
function normalizeContentText(value: string): string {
  return value.trim().replace(/\s+--?\s+/g, ' — ');
}

function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeSource(source: Source): Source {
  const result = { ...source, title: normalizeContentText(source.title) };
  if (result.author !== undefined) result.author = normalizeContentText(result.author);
  if (result.organization !== undefined) result.organization = normalizeContentText(result.organization);
  return result;
}

function normalizeSlide(slide: Slide): Slide {
  return {
    ...slide,
    title: normalizeContentText(slide.title),
    subtitle: normalizeContentText(slide.subtitle),
    bullets: slide.bullets.map(normalizeContentText),
    cards: slide.cards.map((card) => ({ title: normalizeContentText(card.title), text: normalizeContentText(card.text) })),
    columns: slide.columns.map((column) => ({ title: normalizeContentText(column.title), items: column.items.map(normalizeContentText) })),
    comparison: slide.comparison === null ? null : {
      left: { title: normalizeContentText(slide.comparison.left.title), items: slide.comparison.left.items.map(normalizeContentText) },
      right: { title: normalizeContentText(slide.comparison.right.title), items: slide.comparison.right.items.map(normalizeContentText) },
    },
    statistics: slide.statistics === null ? null : slide.statistics.map((statistic) => ({
      ...statistic,
      // Preserve value exactly: 3.2x must never become 3.2 or 3%.
      label: normalizeContentText(statistic.label),
      description: normalizeContentText(statistic.description),
      source: statistic.source === undefined ? undefined : normalizeSource(statistic.source),
    })),
    chart: slide.chart === null ? null : {
      ...slide.chart,
      categories: slide.chart.categories.map(normalizeContentText),
      series: slide.chart.series.map((series) => ({ name: normalizeContentText(series.name), values: [...series.values] })),
      unit: normalizeContentText(slide.chart.unit),
      source: normalizeSource(slide.chart.source),
    },
    timeline: slide.timeline.map((event) => ({ date: normalizeContentText(event.date), title: normalizeContentText(event.title), text: normalizeContentText(event.text) })),
    steps: slide.steps.map((step) => ({ title: normalizeContentText(step.title), text: normalizeContentText(step.text) })),
    definition: slide.definition === null ? null : { term: normalizeContentText(slide.definition.term), text: normalizeContentText(slide.definition.text) },
    quote: slide.quote === null ? null : { ...slide.quote, text: normalizeContentText(slide.quote.text), author: normalizeContentText(slide.quote.author), source: slide.quote.source === undefined ? undefined : normalizeSource(slide.quote.source) },
    visual: { ...slide.visual, concept: normalizeContentText(slide.visual.concept), query_en: normalizeQuery(slide.visual.query_en) },
    sources: slide.sources.map(normalizeSource),
  };
}

/**
 * Normalize only after schema validation. The returned object keeps FSM metadata byte-for-byte.
 */
export function normalizePresentation(presentation: Presentation): Presentation {
  return {
    chatId: presentation.chatId,
    presentation: {
      ...presentation.presentation,
      fullTopic: presentation.presentation.fullTopic,
      subject: presentation.presentation.subject,
      studentName: presentation.presentation.studentName,
      group: presentation.presentation.group,
      displayTitle: normalizeContentText(presentation.presentation.displayTitle),
    },
    slides: presentation.slides.map(normalizeSlide),
  };
}
