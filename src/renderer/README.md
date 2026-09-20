# Renderer extraction

Первый извлечённый модуль — `fitText.ts`. Он не рисует PPTX: только оценивает, помещается ли текст в заданную геометрию.

`fitText` возвращает размер шрифта, примерное число строк, высоту и `overflow`. Если минимальный читаемый размер не помогает, renderer должен остановить текущий layout или передать запрос на semantic shortening. Нельзя вызывать `slice()` для спасения заголовка.

Оценка строк приблизительная и должна быть проверена реальным PPTX sample после добавления PptxGenJS. Она не является доказательством визуальной вёрстки.

## Typography policy

Все layouts должны брать размеры из `typography.ts`, а не передавать случайные `fontSize` напрямую. `preferredFontSize` — базовый единый размер роли; `minFontSize` — нижняя граница. `fitText` может уменьшить размер только до этой границы и затем возвращает `overflow`.

`DEFAULT_TYPOGRAPHY` пока наследует Arial и размеры старого renderer. Это технический baseline, а не утверждение о требованиях конкретного учебного заведения. После получения методички или шаблона учреждения меняется одна конфигурация, а не каждый layout.

## First local PPTX

`src/renderer/pptx.ts` сейчас поддерживает только `title`. Команда `npm run sample:title` создаёт `work/title-sample.pptx`, чтобы проверить реальный ZIP/PPTX output. Для остальных layouts renderer возвращает `Layout not implemented`.

PptxGenJS declarations 3.12.0 используют старый module shape. Узкий structural bridge изолирован внутри `pptx.ts`; остальной проект не переводится на `any`.

`renderSourcesSlide` — второй извлечённый layout. Он выводит только supplied structured sources: номер, title, author/organization, year и URL при наличии. Большие cards и images запрещены; вертикальная позиция следующего источника строится из измеренной высоты предыдущего блока.

`renderConclusionSlide` — третий извлечённый layout. Он требует ровно три supplied cards, не принимает image и не рисует центральную декоративную плашку. Номера, title и text takeaways раскладываются по вертикали с измеренной высотой блоков.

`renderDefinitionSlide` — четвёртый извлечённый layout. Он требует supplied `definition.term` и `definition.text`, разделяет крупный термин и обычное объяснение, не принимает images и блокирует overflow.

`renderHeroSlide` — пятый извлечённый layout. Он использует только переданные `title` и `subtitle` как тезис, добавляет компактную текстовую иерархию и не создаёт изображение или учебный текст сам. Если subtitle пустой или visual нужен, renderer останавливается с ошибкой; silent fallback отсутствует. `image_text` и остальные ещё не перенесённые layouts по-прежнему отклоняются.
