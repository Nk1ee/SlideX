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

Visual search: slide purpose → concept → query_en, не topic → stock photo. NO IMAGE > BAD IMAGE. Отсекать generic businessman/handshake/success/wooden letters/random portrait/laptop/teamwork, когда нет связи со смыслом. Provider adapter должен хранить provider ID, source URL, metadata и query; dedupe по provider ID или binary hash, не base64 slice. Формы: rectangle/rounded/full bleed/background; круговая маска не default. Image subsystem реализован в `src/images/`; текстовая relevance-оценка не гарантирует семантическую пригодность. Для каждого найденного файла нужны проверка лицензии, авторство и визуальный просмотр перед production. Фотографии допускают cover-crop; диаграммы должны вписываться полностью и сохранять читаемый контраст.

Выбор формата проходит через [semantic visual planning policy](visual-planning-policy.md). Возраст нельзя угадывать по полю `group`; до появления trusted educationStage/schoolGrade применяется `unknown`. Chart разрешается только при supplied numeric data и source. Число слайдов задаёт верхний бюджет визуально насыщенных слайдов, но не требует заполнять его нерелевантными изображениями.

AI image evaluator является классификатором, а не генератором. Он получает только проверенное изображение и контекст слайда, возвращает `accept/reject/review` и не меняет content. `review`, ошибка API и schema mismatch обрабатываются как отсутствие разрешения использовать изображение. Полный контракт и дальнейшая проверка PNG описаны в [AI-контроле качества](ai-quality-control.md).

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

## Typography policy

Размер задаётся ролью, а не layout: COVER_TITLE, HERO, TITLE, SUBTITLE, BODY, LABEL, CAPTION, NUMBER. `COVER_TITLE` используется только для названия презентации на титульном слайде; `TITLE` — для заголовков остальных слайдов. Одинаковая роль имеет одинаковый базовый размер на всех слайдах. Уменьшение допускается только до `minFontSize`; если блок не помещается, возвращается overflow и требуется semantic shortening.

Текущие Arial и размеры в `src/renderer/typography.ts` — provisional baseline из Val Town. Нормативные значения нужно заменить после получения требований конкретного учебного заведения.
