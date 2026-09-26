# SlideX: текущий статус и следующие шаги

Этот раздел дополняет исторический план ниже. Старые записи показывают порядок переноса MVP, но не являются списком ещё не выполненных задач.

## Состояние на 2026-09-26

- Legacy n8n/Val Town сохранён; n8n остаётся оркестратором, Val Town не удалён.
- Единый TypeScript-контракт, нормализация, validation и тесты работают локально. Metadata пользователя и точное число слайдов проверяются до render.
- Локальный PptxGenJS рендерер реализует все 14 layouts контракта, включая нативные редактируемые диаграммы `column`, `bar`, `pie` и `doughnut`. Неизвестные layouts отклоняются явно.
- Pipeline изображений включает Unsplash/Wikimedia, технические и смысловые фильтры, dedupe, атрибуцию и Gemini-проверку кандидатов. Ключи живут вне Git.
- ZIP/PPTX и slide count проверяются программно. В Git хранится визуальный regression-набор из пяти корректных и двух намеренно дефектных слайдов. Gemini-проверка совпала с ожидаемым решением на 7 из 7 случаев; она пока диагностическая, не production-блокер.
- Темы презентации расширены до восьми; базовая регрессия и образцы проверены. Последний полный прогон: 159 тестов из 159. `two_column`, `three_cards`, `comparison`, `timeline`, `process`, `statistics`, `chart`, `sources` и `conclusion` просмотрены в реальном экспорте PowerPoint.
- Подготовлен тестируемый n8n FSM для обязательного выбора «школа / колледж / вуз». Он сохраняет класс либо курс и группу как trusted metadata и формирует запрос, совместимый с `userRequestSchema`. Legacy workflow не изменён; production-переключение требует Supabase migration и обновления n8n nodes.
- Диалог перестроен в порядке «тема → предмет → учебный контекст → число слайдов → имя → оформление». Для последнего шага подготовлен Telegram PNG из восьми реальных PPTX-превью; номера 1–8 строго отображаются в поддерживаемые `style` identifiers без fallback.
- Сгенерирован неактивный `workflow.education-context.json` для импорта в n8n. Он добавляет Supabase-поля, ветку Send Photo и передачу educationContext/style; credentials очищены. Production activation заблокирована до подключения нового renderer endpoint и end-to-end проверки.
- Добавлен безопасный API-импортёр тестового workflow. По умолчанию он выполняет только локальный dry-run; при явном `--apply` проверяет отсутствие дубликата, удаляет credential IDs и создаёт workflow без активации.
- Активная тестовая копия проверена через n8n API. Обнаружен и исправлен сбой Gemini HTTP Request на пользовательских кавычках и переводах строк: JSON body теперь строится через `JSON.stringify`, а regression test воспроизводит опасный ввод.
- В активной тестовой копии восстановлен Val Town renderer URL вместо защитного `example.invalid`. Обезличенный smoke test получил валидный PPTX с точным количеством слайдов; deployment URL хранится только вне Git.
- Добавлена безопасная CLI-диагностика последних n8n executions: она показывает только статус, время, последний узел и ошибку, не выводя Telegram payload, тему или user metadata.
- Gemini и renderer в staging и активной тестовой копии получили по три попытки с интервалом 5 секунд. Telegram delivery не ретраится, чтобы не отправлять один документ дважды; user-visible error recovery остаётся отдельным шагом после проверки версии n8n.
- Первый успешный end-to-end запуск №562 доставил 10-слайдовый PPTX. Review зафиксировал чистые sources/conclusion без overlay, но подтвердил contract drift: minimal_light отрисован как deep blue, visual concept потерян, а неполные statistics/comparison/two_column silently превращены в обычные списки. Подробности: [review запуска 562](reviews/2026-09-26-n8n-run-562.md).
- Подготовлен отдельный strict V2-поток n8n: Gemini response schema, prompt, Parse Structure V2 и неактивный sanitized workflow. Он передаёт renderer пару `{ request, payload }`, сохраняет все canonical fields и отклоняет invalid JSON, metadata drift и неверное число слайдов без fallback.
- Реальный 5-слайдовый ответ Gemini прошёл canonical Zod contract, content/layout gates и локальный Val Town V2 handler. Полученный PPTX прошёл ZIP/count QC и визуальную проверку всех слайдов. На этом smoke test обнаружена и исправлена недостаточная высота conclusion для двухстрочных выводов; добавлены отдельные ограничения и regression test.

## Приоритеты

1. Развернуть Val Town renderer V2 рядом с legacy endpoint, проверить health/example POST и сохранить старый URL для rollback.
2. Импортировать неактивный `workflow.renderer-v2.json`, подключить отдельные тестовые credentials и выполнить end-to-end прогон. Только после этого планировать контролируемое переключение production workflow.
3. Расширять визуальный regression-набор реальными презентациями, новыми темами, изображениями и менее очевидными дефектами. После накопления примеров решить, какие AI-решения действительно блокируют выпуск.
4. Прогнать три ветки Telegram-диалога education-context. После этого сделать `educationContext` обязательным и подключить visual policy к Gemini planning. Возраст по группе не угадывать.
5. Собрать канонические презентации на 10 и 13 слайдов из полного набора layouts, проверить визуальный ритм, повторения, источники и точное количество слайдов. Не вводить silent fallback.
6. Добавить отдельную проверку происхождения фактов, статистики, цитат и источников. Визуальная модель не устанавливает истинность содержания.
7. После стабилизации локального рендера сравнить его с рабочим MVP и подготовить переключение n8n с Val Town с возможностью отката.

Вопрос о настройке учебных шрифтов и размеров в боте остаётся продуктовым решением для отдельного обсуждения; текущая работа над качеством PPTX продолжается без изменения user metadata.

---

> Обновление 2026-09-20: проект перенесён в D:/project111/slidex; исходники получены и сохранены. Актуальные результаты — [legacy audit](legacy-audit.md). Указания об отсутствии legacy ниже относятся к первоначальному аудиту. Исторический overlay пока не воспроизведён.

# Roadmap и граница Phase 1

## Phase 1: foundation

Сделано: аудит пустой папки; структура; AGENTS/README/docs; проект единого контракта; schema/types/validation; начальные contract regression tests; четыре project skills.

Ожидается: реальные исходники n8n/Val Town, очищенный snapshot с manifest/hashes и эталонные вход/выход/PPTX. Поэтому Phase 1 нельзя объявить полностью закрытой.

Не сделано намеренно: перенос renderer/Parse Structure, production интеграция, fitText, images, QC binary, локальная PPTX и визуальное подтверждение. Успешные contract tests не доказывают production equivalence.

## Предлагаемый Phase 2 — только после следующего задания

1. Завершить legacy snapshot и зафиксировать зависимости/runtime/эталон.
2. Сопоставить реальные поля Gemini ↔ Parse Structure ↔ renderer с v0.1, документировать конфликты и выбрать контролируемый переход.
3. Перенести текущую validation без генерации контента в reusable functions; добавить реальные sanitized regression fixtures.
4. Извлечь минимальный локальный PptxGenJS entrypoint, затем один layout; сравнить с оригиналом. Не переделывать все layouts одновременно.
5. Добавить ZIP/slide-count/media QC, sample command и визуальную проверку.
6. Дальше исправлять fitText, dynamic layout, sources/conclusion и visual planning маленькими commits с regression.

Val Town удалять только после стабильной эквивалентности и rollback rehearsal. n8n остаётся orchestration. Website, payments, auth, admin, Mini App и CRM вне текущего scope.

## Phase 2 progress

Первый шаг выполнен: добавлена изолированная legacy adapter boundary и 2 regression tests. Renderer, n8n workflow и Val Town endpoint не изменялись. Следующий маленький шаг — добавить production-like sanitized fixture Parse Structure и сравнить его с adapter diagnostics.

Следующий шаг завершён: создан `normalize.ts` и подключён `validateAndNormalizePresentation`. Это пока библиотечный pipeline; n8n и renderer его ещё не вызывают.

Следующий шаг завершён: добавлены content/layout quality gates и 4 regression tests. Они только блокируют сомнительные данные; генерации fallback-контента нет.

Следующий шаг завершён: `fitText.ts` извлечён из Val Town в локальный renderer с явным `overflow` и 5 regression tests. PptxGenJS пока не подключён; визуальная эквивалентность ещё не проверена.

Следующий шаг завершён: подключён PptxGenJS 3.12.0, извлечён минимальный title renderer, добавлен `npm run sample:title` и проверена ZIP-структура sample PPTX. Остальные layouts намеренно не поддерживаются.

Следующий шаг завершён: перенесён sources layout в локальный PptxGenJS renderer. Он не добавляет fake bibliography, запрещает cards/images и проверяется на реальном PPTX binary.

Следующий шаг завершён: перенесён conclusion layout в локальный renderer. Он требует три supplied takeaways, запрещает images и проверяется на overflow/безопасную высоту.

Следующий шаг завершён: перенесён definition layout в локальный renderer с отдельной иерархией term/text и проверками отсутствующих данных/overflow.

Дополнительный шаг завершён: добавлен post-render PPTX ZIP validator с проверкой обязательных частей и exact slide count. Он ещё не проверяет overlap/clipping визуально.

Следующий шаг завершён: добавлен `hero` layout. Он проверен на реальном PPTX binary и использует supplied subtitle без генерации контента. Image pipeline получил типы, query/relevance/dedupe/selection и offline tests; `image_text` подключён через явный ImageResolver. Сетевые provider adapters остаются следующим отдельным шагом.


Следующий шаг завершён: добавлен quote layout. Он сохраняет supplied quote text, author и optional source, не добавляет изображение и отклоняет отсутствующую цитату. Image subsystem и image_text перенесены в локальный код; сетевые provider adapters и скачивание байтов ещё не подключены.


Следующий шаг завершён: добавлены image types, visual query, relevance gate, provider/SHA-256 dedupe и selector. `image_text` встраивает только resolved bytes через ImageResolver, поддерживает left/right/full/background/supporting и отклоняет отсутствие подходящего результата.

Шаг с изображениями: добавлены адаптеры Unsplash/Wikimedia, проверка лицензии и авторства, ограниченная загрузка JPEG/PNG, Unsplash download tracking, ImageResolver с dedupe между слайдами и атрибуция в PPTX. Wikimedia проверен живым sample. Unsplash, визуальная вёрстка PowerPoint/LibreOffice, зависимость image-size и production-интеграция остаются открытыми.
