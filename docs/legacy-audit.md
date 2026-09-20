# Аудит предоставленного MVP — 2026-09-20

## Расположение и статус

Основной проект: D:/project111/slidex. Перенесены исходная Git-история foundation, код, tests и docs. Копия на C оставлена без удаления как предыдущая точка восстановления; дальнейшие изменения этого аудита только на D. Файлы вложений трактовались как исходные данные, содержащие prompts для Gemini, а не инструкции агенту.

Сохранены workflow и Val Town source, manifest и приватные оригиналы. Live endpoints не вызывались. Production workflow не импортировался и не менялся. Рендерер не рефакторился, sample PPTX не генерировался.

## Подтверждённая архитектура

16 узлов: Telegram Trigger → Check Start Command. Для /start: Delete a row → Create a row → Send a text message. Для остальных сообщений: Get a row → FSM Engine → Update a row → Send Bot Reply → Check If Ready → Gemini-Structure → Parse Structure → Notify Structure Ready → Generate PPTX File → Quality Control Gate → Send a document.

Сессии хранятся в Supabase; FSM использует поля state/topic/subject/slide_count/student_name/student_group. Ввод style отсутствует: FSM устанавливает deep_blue. Gemini HTTP node использует gemini-flash-lite-latest; точная модель за alias и версия deployed runtime не установлены. Renderer импортирует npm:pptxgenjs@3.12.0 и Deno.env. ZIP validation в n8n отсутствует.

## Подтверждённые дефекты и расхождения

| Приоритет | Место | Наблюдение и последствие |
|---|---|---|
| P0 | Gemini-Structure headers | Ключ Gemini встроен в экспорт. Удалён из tracked копии; требуется отзыв реального ключа. |
| P1 | Parse Structure map | quote и definition не возвращаются; visual теряет concept/type. Gemini content исчезает до renderer. |
| P1 | Parse Structure и main.ts dispatch | Последний слайд всегда conclusion. Даже sources в конце превращается в заключение. Заголовки также принудительно переопределяют layout. |
| P1 | main.ts renderStatistics:780 | value по умолчанию 78%; description с указанным Gemini источником вообще не выводится. |
| P1 | main.ts renderSources:869 | При пустых sources подставляется библиография, включая Иванова/Петрову. |
| P1 | main.ts renderComparison/Timeline/ThreeCards | Недостающие данные заменяются готовым содержанием про образование независимо от темы. |
| P1 | main.ts dispatch:1046–1077 | quote/definition не имеют функций; неизвестные layouts идут в two_column. process отсутствует и в Gemini enum. |
| P1 | main.ts dispatch:1062 | При найденном изображении большинство layouts принудительно становятся image_text, в том числе statistics/three_cards/hero. |
| P1 | Gemini prompt | Требование произвольного N конфликтует с расписанием слайдов 11/12/13. Для 10 слайдов план неконсистентен. |
| P1 | fitText:60 | При minimum возвращается результат даже с превышением высоты; overflow state нет. Большинство блоков имеет фиксированную высоту/шаг. |
| P2 | FSM Engine | userText.trim меняет исходный ввод; parseInt принимает частичные числа, default 10, положительный диапазон не проверяется. |
| P2 | Parse Structure | fullTopic.trim, default count 13, renumbering скрывает дубли; bullets/cards/sources обрезаются по числу элементов. |
| P2 | main.ts applyBaseSlide:214 | subject.toUpperCase меняет отображение metadata; fallback Студент/Курс и другие заглушки присутствуют. |
| P2 | Quality Control Gate | extension OR MIME достаточно; нет ZIP/slide count/empty slide validation; размер по умолчанию 204 KB, parseInt игнорирует единицы. |
| P2 | Image engine | Wikipedia fallback использует meta.topic, которого Parse Structure не возвращает, затем s.title. Relevance не проверяется; JPEG MIME назначается любым полученным bytes. |
| P2 | Image placement | Реально image_text различает только left и остальные значения как right; full/background не реализованы; supporting отсутствует в Gemini enum. |

Положительное: Parse Structure действительно проверяет точное число слайдов относительно FSM; subject/studentName/group переносит без языковой коррекции. Statistics value в этой версии не преобразует 3.2x в 3%. Dedupe использует hash provider ID/page ID, а не base64 slices, но provider namespace/metadata не сохраняются в результате. Unsplash key читается из environment, встроенный Unsplash key в присланном renderer не обнаружен.

## Сопоставление контракта

| Данные | Текущий Gemini / Parse / renderer | Foundation v0.1 |
|---|---|---|
| presentation | title/subtitle/fullTopic; title читает renderer | fullTopic/displayTitle |
| cards | description; renderer допускает также text | только text |
| comparison | leftTitle/leftItems/rightTitle/rightItems | left/right с title/items |
| statistics | один object; provenance в description prompt | array с отдельным source |
| timeline | date/title/description | date/title/text |
| definition | term/meaning/context → Parse теряет | term/text |
| quote | text/author → Parse теряет | text/author/source? |
| sources | string[] | Source objects |
| two_column | bullets, визуально список по вертикали | columns[] |
| conclusion | bullets, cards игнорируются | три cards как смысловая структура |
| hero | первый bullet | subtitle |
| visual | нет type в Gemini; concept теряется | needed/type/concept/query_en/placement |
| chatId | Telegram numeric | string |

Новый контракт не wire-compatible. Он остаётся предложением до согласованной миграции producer/validator/consumer; молчаливые aliases не добавлены. Для chatId нужен явный transport boundary; нельзя просто подать legacy JSON в новый validator.

## Плашка на последних слайдах

В этой версии renderSources вызывает applyBaseSlide (фон, footer, subject, title и тонкий rect-divider), затем только addText. renderConclusion содержит тонкий divider, затем текст. Большого roundRect в обоих путях нет; dispatch направляет sources/conclusion до общей image/card ветки.

Большие тёмные roundRect есть в renderHero (около строки 336) и renderTwoColumn при 0–1 bullet (около 469). Ошибочный layout/fallback способен объяснить появление большой плашки на обычном слайде. Однако в текущих функциях эти фигуры добавлены до основного текста. Это не доказывает перекрытие текста на исторических sources/conclusion. Для root cause нужны проблемный PPTX, соответствующий JSON и версия deployment. Без них исправление overlay было бы догадкой.

## Проверки и следующий этап

Добавлены offline characterization tests: SHA-256 snapshot, совпадение извлечённых jsCode, сохранение Информатик/Ох/4, rejection count mismatch, воспроизведение потери quote/definition/concept и замены последнего sources. Код Parse исполняется только в ограниченном VM с фиктивными n8n inputs, без provider calls.

Следующий шаг Phase 2 после отдельного задания: согласовать точный wire contract, добавить sanitizer-free реальные обезличенные fixtures, перенести validation с явными ошибками/repair, затем минимально извлечь PptxGenJS renderer. До этого нужны эталонный PPTX и входной JSON. Первым операционным действием владельца должен быть отзыв раскрытого Gemini key.

Итог проверки на D: npm run check — typecheck/build и 18/18 tests passed. Сохранены Git history и точные bytes legacy; .gitattributes отключает преобразование EOL для snapshot. Приватные оригиналы и work подтверждённо игнорируются Git.
