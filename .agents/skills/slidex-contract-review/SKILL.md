---
name: slidex-contract-review
description: Review SlideX Gemini, validator, and renderer payload compatibility against the single Zod contract.
---

Read `src/presentation/schema.ts`, `types.ts`, `validator.ts`, `docs/json-contract.md`, and available legacy producer/consumer code. Trace each payload field end to end; distinguish missing legacy evidence from confirmed compatibility.

Use cards.text, column.items and the schema's exact nullable/array shapes. Reject aliases and silent field loss. Compare metadata to the separate trusted FSM request, including whitespace and misspellings. Count sources/conclusion inside slideCount. Units, quote, cards and visual fields must survive unchanged.

Add contract regression tests for demonstrated mismatches and run `npm run check`. Never repair missing content by invention. Document wire-format changes explicitly; schema acceptance alone does not prove the renderer supports a layout.
