# Layouts

Все 13 layouts ниже описаны контрактом. Локальный renderer переносится постепенно; перед render проверяется фактический реестр.

| Layout | Обязательный payload | Целевая композиция |
|---|---|---|
| title | title | Тема/displayTitle и точные metadata |
| hero | subtitle | Крупное смысловое утверждение |
| image_text | bullets | Текст и изображение по visual placement |
| two_column | ровно 2 columns | Две самостоятельные смысловые колонки |
| three_cards | ровно 3 cards | Три сопоставимых смысловых блока |
| comparison | comparison | Две стороны сравнения, явные заголовки |
| timeline | непустой timeline | Хронология с датами |
| statistics | непустой statistics с source | Крупные значения с единицами и источником |
| process | непустой steps | Последовательность действий, не хронология |
| definition | definition | Термин и определение |
| quote | quote | Цитата, автор, переданный источник |
| conclusion | ровно 3 cards | Номер, headline, описание, whitespace |
| sources | непустой sources | Editorial list: номер, title, author/organization, year, URL |

Sources и conclusion: visual.needed=false, type=none; никаких больших центральных cards/shapes. Cards в контракте conclusion — структура содержания, не команда нарисовать прямоугольник.

Deep blue: фон #0A1128, акцент #38BDF8, текст #FFFFFF. Roles: HERO, TITLE, SUBTITLE, BODY, LABEL, CAPTION; BODY regular/medium, TITLE/NUMBER bold, LABEL semibold.

Image failure: image_text получает только уже отобранный ImageCandidate с provider ID и bytes. Если resolver возвращает null, renderer возвращает диагностируемую ошибку; orchestration может выбрать two_column/three_cards только при наличии их реального контента. Неизвестный layout никогда не заменяется.

fitText: оценить строки/высоту по width, height и fontSize; умеренно уменьшать до minimum, затем overflow. Блок возвращает height/bottomY; вертикальная позиция следующего блока = измеренная высота + gap. Семантическое сокращение — работа Gemini.

## two_column

`two_column` принимает ровно две структуры `{ title, items }`. Обе колонки являются самостоятельными смысловыми блоками и измеряются отдельно. Layout не принимает изображение, не читает `bullets` вместо `columns` и не используется как fallback для неизвестного layout. Вертикальная линия разделяет области чтения; это функциональный элемент, который рисуется до текста. Если пункты не помещаются при минимальном размере BODY, renderer возвращает overflow, а смысловое сокращение выполняется на AI/orchestration-слое.

## three_cards

`three_cards` принимает ровно три структуры `{ title, text }`. Это три сопоставимых смысловых блока, а не три декоративные UI-карточки: номер и верхняя линия помогают группировке, но не закрывают слайд тяжёлыми панелями. Layout не принимает изображения и не создаёт fallback из `bullets`. Заголовок и текст каждого блока измеряются независимо; overflow возвращается как ошибка для semantic repair.

## comparison

`comparison` принимает объект `{ left: { title, items }, right: { title, items } }`. Header-зоны и центральный `VS` показывают отношение между сторонами; это отличает layout от двух независимых колонок. Изображения и legacy-поля `leftTitle/leftItems/rightTitle/rightItems` не используются. Обе стороны измеряются отдельно и отклоняются при overflow.

## timeline

`timeline` принимает от одного до четырёх событий `{ date, title, text }`. `date` является обязательным смысловым элементом над временной осью; title и text располагаются под своей точкой. Layout не принимает изображения, не придумывает события и не подменяет отсутствующие данные. Более длинная хронология должна быть разделена на несколько слайдов на AI/orchestration-слое.


Image subsystem: visual.concept/query_en → provider search → provenance/relevance → provider-ID or SHA-256 dedupe → ImageResolver → PPTX. Renderer не выполняет network search и не принимает URL без bytes.
