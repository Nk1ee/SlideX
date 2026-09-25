# Renderer extraction

Первый извлечённый модуль — `fitText.ts`. Он не рисует PPTX: только оценивает, помещается ли текст в заданную геометрию.

`fitText` возвращает размер шрифта, примерное число строк, высоту и `overflow`. Если минимальный читаемый размер не помогает, renderer должен остановить текущий layout или передать запрос на semantic shortening. Нельзя вызывать `slice()` для спасения заголовка.

Оценка строк приблизительная и должна быть проверена реальным PPTX sample после добавления PptxGenJS. Она не является доказательством визуальной вёрстки.

## Typography policy

Все layouts должны брать размеры из `typography.ts`, а не передавать случайные `fontSize` напрямую. `preferredFontSize` — базовый единый размер роли; `minFontSize` — нижняя граница. `fitText` может уменьшить размер только до этой границы и затем возвращает `overflow`.

`DEFAULT_TYPOGRAPHY` пока наследует Arial и размеры старого renderer. Это технический baseline, а не утверждение о требованиях конкретного учебного заведения. После получения методички или шаблона учреждения меняется одна конфигурация, а не каждый layout.

## First local PPTX

`src/renderer/pptx.ts` сейчас поддерживает `title`, `sources`, `conclusion`, `definition`, `hero`, `quote`, `two_column` и `image_text`. Команда `npm run sample:title` создаёт `work/title-sample.pptx`; image_text требует явный ImageResolver. Остальные layouts renderer возвращает как `Layout not implemented`.

PptxGenJS declarations 3.12.0 используют старый module shape. Узкий structural bridge изолирован внутри `pptx.ts`; остальной проект не переводится на `any`.

`renderSourcesSlide` — второй извлечённый layout. Он выводит только supplied structured sources: номер, title, author/organization, year и URL при наличии. Большие cards и images запрещены; вертикальная позиция следующего источника строится из измеренной высоты предыдущего блока.

`renderConclusionSlide` — третий извлечённый layout. Он требует ровно три supplied cards, не принимает image и не рисует центральную декоративную плашку. Номера, title и text takeaways раскладываются по вертикали с измеренной высотой блоков.

`renderDefinitionSlide` — четвёртый извлечённый layout. Он требует supplied `definition.term` и `definition.text`, разделяет крупный термин и обычное объяснение, не принимает images и блокирует overflow.

`renderHeroSlide` — пятый извлечённый layout. Он использует только переданные `title` и `subtitle` как тезис, добавляет компактную текстовую иерархию и не создаёт изображение или учебный текст сам. Если subtitle пустой или visual нужен, renderer останавливается с ошибкой; silent fallback отсутствует. `image_text` подключён через явный `ImageResolver`; если resolver не вернул подходящее изображение, renderer возвращает ошибку для явного выбора другого layout.

`renderQuoteSlide` — шестой извлечённый layout. Он выводит только переданные `quote.text`, `quote.author` и при наличии `quote.source`. Цитата не создаётся renderer-ом, изображение запрещено, а длинный текст завершается ошибкой при достижении минимального читаемого размера.

`renderTwoColumnSlide` использует только две переданные структуры `columns`. Заголовок и пункты каждой стороны измеряются независимо, а следующий блок начинается после измеренной высоты заголовка. Композиция плоская: функциональный вертикальный разделитель вместо двух больших карточек. Изображения, неполные колонки и текст, который не помещается при минимальном BODY-размере, отклоняются. Это намеренное исправление legacy-поведения, где `two_column` рисовал вертикальный список `bullets` и служил silent fallback для неизвестных layout.
