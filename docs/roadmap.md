> Обновление 2026-09-20: проект перенесён в D:/project111/slidex; исходники получены и сохранены. Актуальные результаты — [legacy audit](legacy-audit.md). Указания об отсутствии legacy ниже относятся к первоначальному аудиту. Исторический overlay пока не воспроизведён.

# Roadmap и граница Phase 1

## Phase 1: foundation

Сделано: аудит пустой папки; структура; AGENTS/README/docs; проект единого контракта; schema/types/validation; начальные contract regression tests; четыре project skills.

Ожидается: реальные исходники n8n/Val Town, очищенный snapshot с manifest/hashes и эталонные вход/выход/PPTX. Поэтому Phase 1 нельзя объявить полностью закрытой.

Не сделано намеренно: перенос renderer/Parse Structure, production интеграция, fitText, images, QC binary, локальная PPTX и визуальное подтверждение. Успешные contract tests не доказывают production equivalence.

## Предлагаемый Phase 2 — только после следующего задания

1. Завершить legacy snapshot и зафиксировать зависимости/runtime/эталон.
2. Сопоставить реальные поля Gemini ↔ Parse Structure ↔ renderer с v0.1, документировать конфликты и выбрать контролируемый переход.
3. Перенести текущую validation без генерации контента в reusable functions; добавить реальные sanitized regression fixtures.
4. Извлечь минимальный локальный PptxGenJS entrypoint, затем один layout; сравнить с оригиналом. Не переделывать все layouts одновременно.
5. Добавить ZIP/slide-count/media QC, sample command и визуальную проверку.
6. Дальше исправлять fitText, dynamic layout, sources/conclusion и visual planning маленькими commits с regression.

Val Town удалять только после стабильной эквивалентности и rollback rehearsal. n8n остаётся orchestration. Website, payments, auth, admin, Mini App и CRM вне текущего scope.
