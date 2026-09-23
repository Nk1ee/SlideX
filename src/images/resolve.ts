import { createHash } from 'node:crypto';
import type { Slide } from '../presentation/types.js';
import { imageAiQualityReportSchema, type ImageAiQualityEvaluator } from '../qc/visualAi.js';
import { imageIdentity } from './dedupe.js';
import { downloadImage } from './download.js';
import { scoreImageRelevance } from './relevance.js';
import { createImageSearchQuery, searchVisual } from './search.js';
import type { ImageCandidate, ImageSearchProvider } from './types.js';

type Fetcher = typeof fetch;
export type ImageResolutionIssue = { provider: string; reason: string };

/** Maintains per-presentation dedupe while keeping search and PPTX rendering separate. */
export function createImageResolver(options: {
  providers: readonly ImageSearchProvider[];
  fetchImpl?: Fetcher;
  unsplashAccessKey?: string;
  minWidth?: number;
  minHeight?: number;
  imageQualityEvaluator?: ImageAiQualityEvaluator;
  maxAiCandidatesPerSlide?: number;
  onIssue?: (issue: ImageResolutionIssue) => void;
}): (slide: Slide) => Promise<ImageCandidate | null> {
  const maxAiCandidates = options.maxAiCandidatesPerSlide ?? 3;
  if (!Number.isInteger(maxAiCandidates) || maxAiCandidates < 1 || maxAiCandidates > 10) {
    throw new Error('maxAiCandidatesPerSlide must be an integer between 1 and 10');
  }
  const usedIds = new Set<string>();
  const usedHashes = new Set<string>();
  return async (slide: Slide): Promise<ImageCandidate | null> => {
    const query = createImageSearchQuery(slide.visual);
    if (!query) return null;
    let aiChecks = 0;
    for (const provider of options.providers) {
      const scored: Array<{ candidate: ImageCandidate; score: number }> = [];
      try {
        for (const candidate of await searchVisual(provider, slide.visual)) {
          const report = scoreImageRelevance(candidate, query);
          if (report.accepted) scored.push({ candidate, score: report.score });
          else options.onIssue?.({ provider: provider.id, reason: report.reason ?? 'Relevance check failed' });
        }
      } catch {
        options.onIssue?.({ provider: provider.id, reason: 'Search request failed' });
        continue;
      }
      scored.sort((left, right) => right.score - left.score);
      for (const { candidate } of scored) {
        const identity = imageIdentity(candidate);
        if (usedIds.has(identity)) continue;
        let downloaded: ImageCandidate;
        try {
          downloaded = await downloadImage(candidate, { ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}), ...(options.unsplashAccessKey ? { unsplashAccessKey: options.unsplashAccessKey } : {}), ...(options.minWidth ? { minWidth: options.minWidth } : {}), ...(options.minHeight ? { minHeight: options.minHeight } : {}) });
        } catch {
          options.onIssue?.({ provider: candidate.provider, reason: 'Image download or verification failed' });
          continue;
        }
        if (!downloaded.bytes) {
          options.onIssue?.({ provider: candidate.provider, reason: 'Verified image has no binary data' });
          continue;
        }
        const hash = createHash('sha256').update(downloaded.bytes).digest('hex');
        if (usedHashes.has(hash)) continue;
        if (options.imageQualityEvaluator) {
          if (aiChecks >= maxAiCandidates) {
            options.onIssue?.({ provider: candidate.provider, reason: 'AI image quality check limit reached' });
            return null;
          }
          aiChecks++;
          try {
            const report = imageAiQualityReportSchema.parse(await options.imageQualityEvaluator({
              slide,
              image: { ...downloaded, bytes: downloaded.bytes },
            }));
            if (report.decision !== 'accept') {
              options.onIssue?.({
                provider: candidate.provider,
                reason: report.decision === 'reject'
                  ? 'AI image quality check rejected candidate'
                  : 'AI image quality check requires review',
              });
              continue;
            }
          } catch {
            options.onIssue?.({ provider: candidate.provider, reason: 'AI image quality check failed' });
            return null;
          }
        }
        usedIds.add(identity);
        usedHashes.add(hash);
        return downloaded;
      }
    }
    return null;
  };
}
