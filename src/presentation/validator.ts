import { presentationSchema, userRequestSchema } from './schema.js';
import { normalizePresentation } from './normalize.js';
import type { Layout, Presentation } from './types.js';

/** Validate against trusted FSM data, never against metadata supplied by the model alone. */
export function validatePresentation(input: unknown, trustedRequest: unknown): Presentation {
  const request = userRequestSchema.parse(trustedRequest);
  const result = presentationSchema.parse(input);
  const metadata = result.presentation;
  if (metadata.fullTopic !== request.topic) throw new Error('Metadata mismatch: topic');
  for (const field of ['subject', 'studentName', 'group', 'slideCount', 'style'] as const) {
    if (metadata[field] !== request[field]) throw new Error(`Metadata mismatch: ${field}`);
  }
  return result;
}

/** Call before rendering with the actual renderer registry. Phase 1 has no renderers. */
export function assertRenderable(presentation: Presentation, implementedLayouts: ReadonlySet<Layout>): void {
  for (const slide of presentation.slides) {
    if (!implementedLayouts.has(slide.layout)) throw new Error(`Layout not implemented: ${slide.layout}`);
  }
}

/** Validate the wire payload, compare FSM metadata, then normalize AI-authored text. */
export function validateAndNormalizePresentation(input: unknown, trustedRequest: unknown): Presentation {
  return normalizePresentation(validatePresentation(input, trustedRequest));
}

