> Обновление 2026-09-20: проект перенесён в D:/project111/slidex; исходники получены и сохранены. Актуальные результаты — [legacy audit](legacy-audit.md). Указания об отсутствии legacy ниже относятся к первоначальному аудиту. Исторический overlay пока не воспроизведён.

# Правила качества

Факты важнее визуального заполнения. Никаких придуманных bullets, статистики, цитат, источников, дат или сравнений. Не преобразовывать последний слайд в conclusion. Сохранять quote/cards/visual и все единицы. User metadata не исправлять; языковые правки допустимы только для AI content в отдельном явном этапе.

## Уже проверяется

- Exact count включая sources/conclusion, sequential unique numbers, metadata equality с FSM.
- Известный layout, строгое имя каждого поля и обязательное содержимое выбранного layout.
- Quote presence, provenance statistics, структура sources и формат URL.
- Третье повторение layout требует явного объяснения; содержательность объяснения проверяется отдельно.
- No image на sources/conclusion. Нет автоматической генерации/подстановки данных.

## До render — ещё предстоит

Проверить реальную реализацию layout, факты/источники/цитаты, language quality, displayTitle, количество и длину bullets, fitting и overflow, содержательность repetitionReason, semantic visual relevance. Лимиты fitting привязать к геометрии и шрифтам после аудита renderer, не придумывать произвольные числа.

Visual search: slide purpose → concept → query_en, не topic → stock photo. NO IMAGE > BAD IMAGE. Отсекать generic businessman/handshake/success/wooden letters/random portrait/laptop/teamwork, когда нет связи со смыслом. Provider adapter должен хранить provider ID, source URL, metadata и query; dedupe по provider ID или binary hash, не base64 slice. Формы: rectangle/rounded/full bleed/background; круговая маска не default. Реализация image subsystem пока отсутствует.

## После render — ещё предстоит

- Непустой binary, MIME `application/vnd.openxmlformats-officedocument.presentationml.presentation`.
- Валидный ZIP, `[Content_Types].xml`, `ppt/`, `ppt/slides/`, media если ожидаются изображения.
- Число slides по relationships/slide XML совпадает с request, нет пустых слайдов.
- Визуальная проверка всех слайдов: overlap, clipping, читаемость, rhythm, sources/conclusion.
- Z-order: background → функциональная decoration → images → content → footer.

## Историческое перекрытие последних слайдов

Root cause **не установлен**: Val Town source и проблемный PPTX отсутствуют. Не называть предполагаемый поздний addShape доказанной причиной. После получения проверить последовательность shapes, inherited/shared background helpers, координаты, opacity и XML z-order на sources/conclusion. Зафиксировать воспроизводящий fixture, минимальное исправление и визуальный regression.

## Pre-render gates

`validateContentQuality` и `validateLayoutPlan` работают после schema validation и normalization. Они возвращают `QualityReport` с `code/path/message`; ошибки блокируют render. Лимиты текста — защитный технический gate, а не semantic shortening: длинный текст должен быть сокращён Gemini или отправлен на repair generation.
