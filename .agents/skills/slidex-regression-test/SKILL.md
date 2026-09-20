---
name: slidex-regression-test
description: Run SlideX canonical contract and presentation regressions while distinguishing synthetic fixtures from legacy parity evidence.
---

Run `npm run check`. Canonical topics live in `tests/regression/fixtures.ts`: neural networks (10), AI in education (13, subject Информатик, student Ох, group 4), Peter I reforms (10). Include the long-title/long-bullet stress case in validator tests.

Check exact counts, unchanged FSM metadata, sequential numbers, required payloads, no invented statistics/sources/quotes and no contract aliases. Fixtures are synthetic structural inputs, not verified teaching content or Gemini captures.

Once a renderer/sample command exists, generate the canonical decks and verify PPTX ZIP/count/media plus visual overflow/last slides. Until then report renderer regression as unavailable, not passed. Preserve original fixtures when introducing a reproducer; never weaken invariants to make a failing test pass.
