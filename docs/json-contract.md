# Контракт v0.1 — проект до сверки с legacy

Источник истины: `src/presentation/schema.ts`. Типы в `types.ts` выводятся из Zod. Все объекты strict: неизвестные поля — ошибка, aliases отсутствуют. Schema принимает разобранный JSON; transport parsing и repair orchestration пока не перенесены.

## Envelope и metadata

`chatId: string`, `presentation`, `slides: Slide[]`.

FSM request: `topic`, `subject`, `studentName`, `group`, `slideCount`, `style`. Metadata: `fullTopic` строго равен `topic`, остальные одноимённые поля строго равны request. `displayTitle` — отдельное содержательное сокращение от Gemini, не slice. `language: ru`; `style` — стабильный идентификатор из `themeIdSchema`. Каталог названий, семейств, палитр и геометрии описан в [presentation-themes.md](presentation-themes.md). `deep_blue` сохраняется как совместимый текущий вариант. Строковые поля metadata не исправляются и не обрезаются. Пустые обязательные значения отклоняются. Счётчик — положительное целое; длина массива строго совпадает, номера строго 1..N.

## Slide

Все перечисленные payload-поля обязательны, даже если не используются: `number`, `type`, `layout`, `title`, `subtitle`, `bullets`, `cards`, `columns`, `comparison`, `statistics`, `chart`, `timeline`, `steps`, `definition`, `quote`, `visual`, `sources`. Пустые массивы/nullable payload допустимы только если выбранный layout их не требует. `type`: title/content/conclusion/sources, соответствует роли layout. `repetitionReason?: string` требуется начиная с третьего одинакового layout подряд.

| Поле | Единственная форма |
|---|---|
| cards | `{title, text}[]`; не description |
| columns | `{title, items: string[]}[]` |
| comparison | `{left: {title, items}, right: {title, items}}` или null |
| statistics | `{value: string, label, description, source?}[]` или null |
| chart | `{kind, categories, series, unit, source}` или null |
| timeline | `{date: string, title, text}[]` |
| steps | `{title, text}[]`; порядок массива определяет номер шага |
| definition | `{term, text}` или null |
| quote | `{text, author, source?}` или null |
| sources | `Source[]` |

`Source`: title, optional author/organization/year/url; нужен хотя бы author, organization или HTTP(S) URL. Year — целое 1..9999. Это проверка формы и идентифицируемости, **не доказательство существования источника**. Проверка доступности и соответствия утверждению — будущий content QC.

Statistics value сохраняется строкой без изменения единиц (`3.2x` остаётся `3.2x`). Для statistics layout Phase 1 консервативно требует source для каждого значения: автоматическая классификация «сильного утверждения» пока отсутствует. Quote без text/author недопустим; переданная цитата ещё требует фактологической проверки.

`chart.kind`: `column`, `bar`, `pie` или `doughnut`. `categories` содержит 2–8 подписей; каждая series имеет форму `{name, values}` и содержит ровно одно конечное число на категорию. Столбчатые диаграммы принимают 1–3 серии. Круговая и кольцевая диаграммы принимают ровно одну серию, запрещают отрицательные значения и полностью нулевой набор. `unit` передаётся явно и не вычисляется renderer. `source` обязателен; validator не создаёт данные и библиографию.

`visual`: needed boolean, type none/photo/illustration/diagram, concept string, query_en string, placement left/right/full/background/supporting. При needed=true нужны непустые concept/query_en и type не none. Schema не может доказать язык поисковой строки или смысловую релевантность.

Ограничения текста в символах пока не выдаются за точное fitting. Длинный текст сохраняется полностью; после появления fitText overflow должен блокировать render и возвращаться на semantic repair. Структурная валидация не является полным quality gate.
