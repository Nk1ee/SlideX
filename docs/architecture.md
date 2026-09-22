> Обновление 2026-09-20: проект перенесён в D:/project111/slidex; исходники получены и сохранены. Актуальные результаты — [legacy audit](legacy-audit.md). Указания об отсутствии legacy ниже относятся к первоначальному аудиту. Исторический overlay пока не воспроизведён.

# Архитектура

## Текущий MVP — подтверждён сохранённым legacy snapshot

Telegram Trigger → FSM Engine → Gemini Structure → Parse Structure → Val Town HTTP endpoint → PptxGenJS → Send Document.

n8n: Telegram, состояние сессии, сбор user metadata, вызовы AI/renderer, доставка. Gemini: содержание, storyline, выбор layout, semantic visual planning и shortening. Val Town: тема, изображения, layouts и PPTX.

## Границы переносимого кода

`presentation`: единый контракт и сверка с независимым FSM request. `renderer`: PptxGenJS, геометрия, typography, fitting и композиция. `images`: поиск по visual concept/query_en, provider metadata, relevance, dedupe и явный selector. `qc`: до- и послерендерные проверки. Image subsystem не генерирует content и отдаёт null, когда релевантного результата нет.

Validator не дополняет смысл. Renderer не пишет учебный контент. При missing data возвращать ошибки для явного repair generation в orchestration. Gemini не управляет authoritative metadata. `chatId` должен быть получен из n8n; этот контракт не заменяет проверку маршрутизации Telegram.

## Решения Phase 1

- Node.js 24+, TypeScript strict, ES modules, Zod для runtime validation и вывода типов из одной схемы.
- Встроенный Node test runner; отдельный тестовый фреймворк не нужен.
- Валидация принимает `unknown`; нет coercion/defaults/trim mutation. Неизвестные поля отклоняются.
- Контракт — проект v0.1 до сверки с legacy, не подтверждённый production wire format.
- Поля для process/definition/two_column заданы явно, потому что базовый пример не определял их payload.
- Целевые layouts и реально реализованные layouts различаются. Перед render используется фактический реестр; сейчас локально реализованы title, sources, conclusion, definition, hero, quote и image_text.
- Production endpoint, deployment и интеграция n8n не меняются.

Удаление Val Town возможно только после локальной эквивалентности, regression и управляемого переключения с rollback.

## Phase 2: legacy adapter

`src/presentation/legacyAdapter.ts` — явная миграционная граница для старого Parse Structure payload. Она принимает отдельный trusted FSM request и проверяет его через ту же схему, что и новый backend.

Разрешены только доказуемые отображения: `cards.description` → canonical `cards.text`, старый comparison с четырьмя полями → `left/right`, и последовательные номера слайдов. Metadata берётся из FSM, а не из Gemini.

Адаптер отклоняет plain-string sources, statistics без отдельного source, visual без type при `needed=true`, а также quote/definition, если они присутствуют в исходном сыром payload: старый Parse Structure не сохранял эти поля, поэтому восстановить их нельзя. Это сознательный отказ, а не fallback.

Адаптер не вызывается из n8n и не подключён к renderer. Сначала нужно согласовать wire contract и покрыть реальными обезличенными fixtures.

## Validation pipeline

Для будущего backend точка входа `validateAndNormalizePresentation(input, trustedRequest)` объединяет два шага: `validatePresentation` сначала проверяет неизвестный JSON, структуру и точное совпадение metadata с FSM; `normalizePresentation` затем меняет только AI-authored text. Renderer должен получать результат этой функции, а не сырой ответ Gemini.

Пользовательские поля `fullTopic`, `subject`, `studentName`, `group`, `slideCount` и `style` не проходят текстовую нормализацию. `statistics[].value` также не меняется, чтобы единица `3.2x` не превратилась в другое значение.


## Image pipeline

Новый image слой получает только visual plan конкретного слайда. `search.ts` не использует fullTopic, `relevance.ts` отклоняет generic stock и требует смысловое пересечение, `dedupe.ts` сохраняет provider identity или SHA-256. `selection.ts` возвращает лучший accepted candidate либо null. Unsplash/Wikimedia adapters и ограниченная загрузка JPEG/PNG реализованы. Wikimedia и Unsplash проверены живыми запросами. SVG-схемы Wikimedia используются через проверенное PNG-превью; resolver соблюдает приоритет провайдеров и переходит к следующему только как к fallback. `resolve.ts` связывает поиск, relevance и загрузку с renderer через `ImageResolver`.
