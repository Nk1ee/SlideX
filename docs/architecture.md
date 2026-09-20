# Архитектура

## Текущий MVP — описание владельца, исходники ещё не проверены

Telegram Trigger → FSM Engine → Gemini Structure → Parse Structure → Val Town HTTP endpoint → PptxGenJS → Send Document.

n8n: Telegram, состояние сессии, сбор user metadata, вызовы AI/renderer, доставка. Gemini: содержание, storyline, выбор layout, semantic visual planning и shortening. Val Town: тема, изображения, layouts и PPTX.

## Границы переносимого кода

`presentation`: единый контракт и сверка с независимым FSM request. `renderer`: PptxGenJS, геометрия, typography, fitting и композиция. `images`: поиск по visual concept, provider metadata, relevance, dedupe. `qc`: до- и послерендерные проверки. Последние три каталога в Phase 1 зарезервированы, реализаций нет.

Validator не дополняет смысл. Renderer не пишет учебный контент. При missing data возвращать ошибки для явного repair generation в orchestration. Gemini не управляет authoritative metadata. `chatId` должен быть получен из n8n; этот контракт не заменяет проверку маршрутизации Telegram.

## Решения Phase 1

- Node.js 24+, TypeScript strict, ES modules, Zod для runtime validation и вывода типов из одной схемы.
- Встроенный Node test runner; отдельный тестовый фреймворк не нужен.
- Валидация принимает `unknown`; нет coercion/defaults/trim mutation. Неизвестные поля отклоняются.
- Контракт — проект v0.1 до сверки с legacy, не подтверждённый production wire format.
- Поля для process/definition/two_column заданы явно, потому что базовый пример не определял их payload.
- Целевые layouts и реально реализованные layouts различаются. Перед render обязателен `assertRenderable` с фактическим реестром; сейчас реестр пуст.
- Production endpoint, deployment и интеграция n8n не меняются.

Удаление Val Town возможно только после локальной эквивалентности, regression и управляемого переключения с rollback.
