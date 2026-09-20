---
name: pptx-quality-check
description: Check generated SlideX PPTX integrity and visual quality, especially overlap, final slides, and layout rhythm.
---

Read `docs/quality-rules.md` and `docs/layouts.md`. Require an actual PPTX and its trusted request; if unavailable, report the specific checks that remain unperformed.

Verify binary/MIME/ZIP, Content_Types, slide relationships/count and media when expected. Render all slides for visual inspection: overlap, clipping, type hierarchy, repetition and image relevance. Sources need a readable editorial list; conclusion needs three supplied takeaways. Neither uses a large central card or image.

For suspected overlay inspect shape order and bounds in code and slide XML. Record a reproducer and actual root cause; do not infer causation from screenshots alone. Report structural and visual checks separately. Never describe unrendered slides as verified.
