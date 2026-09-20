import type { Visual } from '../presentation/types.js';
import type { ImageSearchProvider, ImageSearchQuery } from './types.js';

/** Convert the structured visual plan into the only query a provider may receive. */
export function createImageSearchQuery(visual: Visual): ImageSearchQuery | null {
  if (!visual.needed) return null;
  const queryEn = visual.query_en.trim();
  const concept = visual.concept.trim();
  if (!queryEn || !concept || visual.type === 'none') {
    throw new Error('Requested visual needs non-empty concept, query_en and type');
  }
  return { queryEn, concept, kind: visual.type, placement: visual.placement };
}

/** Providers are queried only from the slide visual plan, never from fullTopic. */
export async function searchVisual(provider: ImageSearchProvider, visual: Visual) {
  const query = createImageSearchQuery(visual);
  if (query === null) return [];
  const results = await provider.search(query);
  return results.filter((candidate) => candidate.provider === provider.id);
}
