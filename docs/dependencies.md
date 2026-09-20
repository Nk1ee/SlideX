# Зависимости

## PptxGenJS 3.12.0

SlideX зафиксировал `pptxgenjs@3.12.0`, потому что это версия текущего Val Town renderer. Автоматическое обновление сейчас запрещено: сначала нужна визуальная parity-проверка.

## npm audit — 2026-09-20

`npm audit --omit=dev` сообщает две high advisory для транзитивного `image-size` (ICNS/JXL/HEIF parser infinite loop, CWE-835). Цепочка: `pptxgenjs → image-size`. npm предлагает `pptxgenjs@2.2.0`, то есть откат major-версии; он не применён.

До запуска image search/render на непроверенных пользовательских файлах нужно:

- ограничить типы и размер входных изображений;
- не принимать произвольные image bytes без provider/relevance checks;
- проверить, есть ли безопасная совместимая версия image-size или patch upstream;
- повторить audit после решения.

Это зафиксированный риск, а не подтверждение эксплуатации. В текущем title-only renderer изображения не принимаются, поэтому этот риск не закрыт окончательно, но и image pipeline ещё не активирован.
