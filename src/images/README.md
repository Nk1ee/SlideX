# Image subsystem

Image selection starts with the slide visual plan: `visual.concept` explains the idea and `visual.query_en` is the provider query. The image layer never searches by `presentation.fullTopic` and never creates a missing visual.

`types.ts` keeps provider ID, source URL, image URL, MIME type, dimensions, alt text, query and concept together. `relevance.ts` rejects generic stock patterns and requires conservative term overlap. `dedupe.ts` uses `provider + providerId`, or SHA-256 of bytes when a provider ID is unavailable. The layer returns no image when evidence is insufficient.

Network adapters for Unsplash/Wikimedia are deliberately not included in this first step. They will implement `ImageSearchProvider`, read keys only from environment variables and download bytes only after relevance and provenance checks are in place.

selection.ts deduplicates candidates, applies relevance reports and returns the highest-scoring accepted image. An empty selection is a valid result and must trigger layout adaptation, never a blank image area.
