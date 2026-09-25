import type { Presentation } from '../presentation/types.js';

export type QualityIssue = { code: string; path: string; message: string };
export type QualityReport = { ok: boolean; issues: QualityIssue[] };

export const CONTENT_LIMITS = {
  displayTitleChars: 140,
  slideTitleChars: 140,
  bulletsPerSlide: 5,
  bulletChars: 240,
  cardTextChars: 320,
} as const;

function issue(code: string, path: string, message: string): QualityIssue { return { code, path, message }; }
function tooLong(value: string, max: number): boolean { return value.length > max; }

/** Content-only pre-render gate. It reports problems and never repairs content. */
export function validateContentQuality(presentation: Presentation): QualityReport {
  const issues: QualityIssue[] = [];
  const meta = presentation.presentation;
  if (tooLong(meta.displayTitle, CONTENT_LIMITS.displayTitleChars)) issuePush('display_title_too_long', 'presentation.displayTitle', `Display title exceeds ${CONTENT_LIMITS.displayTitleChars} characters`);

  presentation.slides.forEach((slide, slideIndex) => {
    const path = `slides[${slideIndex}]`;
    if (tooLong(slide.title, CONTENT_LIMITS.slideTitleChars)) issuePush('slide_title_too_long', `${path}.title`, `Title exceeds ${CONTENT_LIMITS.slideTitleChars} characters`);
    if (slide.bullets.length > CONTENT_LIMITS.bulletsPerSlide) issuePush('too_many_bullets', `${path}.bullets`, `More than ${CONTENT_LIMITS.bulletsPerSlide} bullets require semantic compression`);
    slide.bullets.forEach((bullet, bulletIndex) => {
      if (tooLong(bullet, CONTENT_LIMITS.bulletChars)) issuePush('bullet_too_long', `${path}.bullets[${bulletIndex}]`, `Bullet exceeds ${CONTENT_LIMITS.bulletChars} characters`);
    });
    slide.cards.forEach((card, cardIndex) => {
      if (tooLong(card.text, CONTENT_LIMITS.cardTextChars)) issuePush('card_text_too_long', `${path}.cards[${cardIndex}].text`, `Card text exceeds ${CONTENT_LIMITS.cardTextChars} characters`);
    });
    slide.columns.forEach((column, columnIndex) => {
      if (column.items.length > CONTENT_LIMITS.bulletsPerSlide) issuePush('too_many_column_items', `${path}.columns[${columnIndex}].items`, `More than ${CONTENT_LIMITS.bulletsPerSlide} items in one column require semantic compression`);
      column.items.forEach((item, itemIndex) => {
        if (tooLong(item, CONTENT_LIMITS.bulletChars)) issuePush('column_item_too_long', `${path}.columns[${columnIndex}].items[${itemIndex}]`, `Column item exceeds ${CONTENT_LIMITS.bulletChars} characters`);
      });
    });
    if (slide.layout === 'statistics') slide.statistics?.forEach((statistic, statisticIndex) => {
      if (!statistic.source) issuePush('statistic_without_source', `${path}.statistics[${statisticIndex}]`, 'Statistics require supplied provenance; the gate will not invent one');
    });
    if (slide.layout === 'quote' && slide.quote === null) issuePush('quote_missing', `${path}.quote`, 'Quote layout requires supplied quote data');
    if (slide.layout === 'sources' && slide.sources.length === 0) issuePush('sources_missing', `${path}.sources`, 'Sources layout requires supplied sources');
    if (slide.visual.needed && (!slide.visual.concept.trim() || !slide.visual.query_en.trim())) issuePush('visual_plan_incomplete', `${path}.visual`, 'Requested visual requires concept and query_en');
  });
  return { ok: issues.length === 0, issues };

  function issuePush(code: string, path: string, message: string): void { issues.push(issue(code, path, message)); }
}

export function assertContentQuality(presentation: Presentation): void {
  const report = validateContentQuality(presentation);
  if (!report.ok) throw new Error(report.issues.map((item) => `${item.path}: ${item.message}`).join('; '));
}
