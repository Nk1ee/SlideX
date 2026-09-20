import type { ImageCandidate, ImageRelevanceReport, ImageSearchQuery } from './types.js';
import { dedupeImages } from './dedupe.js';
import { scoreImageRelevance } from './relevance.js';

export type ImageSelection = {
  candidate: ImageCandidate | null;
  reports: Array<{ candidate: ImageCandidate; report: ImageRelevanceReport }>;
};

/** Select the strongest relevant unique candidate. No accepted candidate means no image. */
export function selectBestImage(candidates: readonly ImageCandidate[], query: ImageSearchQuery): ImageSelection {
  const reports = dedupeImages(candidates).map((candidate) => ({ candidate, report: scoreImageRelevance(candidate, query) }));
  const accepted = reports.filter(({ report }) => report.accepted).sort((left, right) => right.report.score - left.report.score);
  return { candidate: accepted[0]?.candidate ?? null, reports };
}
