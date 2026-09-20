export type ImagePlacement = 'left' | 'right' | 'full' | 'background' | 'supporting';
export type ImageKind = 'photo' | 'illustration' | 'diagram';

/** A provider result with enough provenance to audit and deduplicate it later. */
export type ImageCandidate = {
  provider: string;
  providerId: string;
  sourceUrl: string;
  imageUrl: string;
  mimeType: string;
  width: number;
  height: number;
  altText: string;
  title?: string;
  license?: string;
  query: string;
  concept: string;
  bytes?: Uint8Array;
};

export type ImageSearchQuery = {
  queryEn: string;
  concept: string;
  kind: ImageKind;
  placement: ImagePlacement;
};

export type ImageSearchProvider = {
  id: string;
  search(query: ImageSearchQuery): Promise<readonly ImageCandidate[]>;
};

export type ImageRelevanceReport = {
  accepted: boolean;
  score: number;
  matchedTerms: string[];
  reason?: string;
};
