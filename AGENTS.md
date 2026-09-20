# SlideX

Цель: тема → фактически надёжная учебная PPTX с продуманной композицией.

- n8n сохраняет Telegram, FSM, metadata, AI orchestration и delivery.
- Gemini отвечает за содержание, storyline и semantic visual planning.
- Код отвечает за контракт, validation, layouts, images, rendering и QC.
- Validator не генерирует контент; renderer не придумывает содержание.
- Metadata из FSM сохранять точно, включая опечатки. Количество слайдов строго равно запросу, включая sources/conclusion.
- Единственный контракт — `src/presentation/schema.ts`; типы выводятся из него. Не добавлять compatibility aliases, fake statistics, quotes, sources или silent fallback.
- Сначала сохранить и проверить legacy; менять renderer небольшими проверяемыми шагами. PptxGenJS сохраняется.
- TypeScript strict, ES modules, без any и обрезания смысла через slice.
- Не коммитить секреты. Экспорты legacy сначала проверить и удалить credentials; фиксировать изменения и происхождение снимка.
- Перед коммитом `npm run check`. После изменения renderer нужны PPTX sample, ZIP/slide-count QC и визуальная проверка sources/conclusion и overlap.
- Наличие layout в контракте не означает его реализацию. Перед render проверять реестр реализованных layouts.
- Phase 1 заканчивается foundation; не переходить к переносу renderer без следующего задания.

Подробности: `docs/architecture.md`, `docs/json-contract.md`, `docs/quality-rules.md`, `docs/roadmap.md`.
