---
name: slidex-renderer
description: Modify SlideX PptxGenJS renderers with legacy parity, measured text fitting, and layout regression checks.
---

Read `docs/layouts.md`, `docs/quality-rules.md` and the relevant renderer plus its legacy origin. If legacy is unavailable, record that parity cannot be established; do not fabricate a replacement snapshot.

Make one reasoned extraction or layout fix at a time. Preserve metadata and content; no fake fallback values, semantic slicing or unknown-layout fallback. Add layout to the actual registry only when implemented. Shapes must have a function and precede content in z-order. Text blocks return measured height/bottomY; fitting stops at a readable minimum with explicit overflow.

Run `npm run check`. When a renderer exists, generate a canonical PPTX, validate ZIP/count/media and visually inspect changed slides plus sources/conclusion. Report parity limits; do not claim visual verification from schema tests. Phase 1 does not authorize renderer migration.
