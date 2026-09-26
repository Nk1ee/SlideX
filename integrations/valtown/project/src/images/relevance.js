const GENERIC_PATTERNS = [
    /\bhandshake\b/i,
    /\bbusinessman\b/i,
    /\bmotivational\s+success\b/i,
    /\bwooden\s+letters?\b/i,
    /\brandom\s+portrait\b/i,
    /\bgeneric\s+laptop\b/i,
    /\bteamwork\b/i,
];
const STOP_WORDS = new Set(['about', 'after', 'and', 'from', 'into', 'with', 'the', 'this', 'that', 'using']);
function terms(value) {
    return value.toLowerCase().split(/[^a-z0-9а-яё]+/i).filter((term) => term.length >= 4 && !STOP_WORDS.has(term));
}
/** Conservative offline relevance gate: it rejects generic stock matches and requires evidence of overlap. */
export function scoreImageRelevance(candidate, query) {
    const searchable = `${candidate.altText} ${candidate.title ?? ''}`.trim();
    if (!searchable)
        return { accepted: false, score: 0, matchedTerms: [], reason: 'Image has no searchable description' };
    const generic = GENERIC_PATTERNS.find((pattern) => pattern.test(searchable));
    if (generic)
        return { accepted: false, score: 0, matchedTerms: [], reason: `Generic stock pattern rejected: ${generic.source}` };
    const queryTerms = [...new Set([...terms(query.queryEn), ...terms(query.concept)])];
    const candidateTerms = new Set(terms(searchable));
    const matchedTerms = queryTerms.filter((term) => candidateTerms.has(term));
    const score = queryTerms.length === 0 ? 0 : matchedTerms.length / queryTerms.length;
    if (score < 0.25)
        return { accepted: false, score, matchedTerms, reason: 'Candidate does not provide enough semantic term overlap' };
    return { accepted: true, score, matchedTerms };
}
