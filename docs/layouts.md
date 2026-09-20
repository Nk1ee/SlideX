# Layouts

Все 13 layouts ниже описаны контрактом. **Ни один локальный renderer пока не реализован.** Не передавать schema-valid результат в render без проверки фактического реестра.

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

Image failure: отдельное явное решение image_text → two_column/three_cards возможно только при наличии нужного контента. Нельзя придумывать недостающие колонки/cards. До появления этого механизма render должен вернуть диагностируемую ошибку; неизвестный layout никогда не заменяется.

fitText: оценить строки/высоту по width, height и fontSize; умеренно уменьшать до minimum, затем overflow. Блок возвращает height/bottomY; вертикальная позиция следующего блока = измеренная высота + gap. Семантическое сокращение — работа Gemini.
