# SlideX

Telegram-сервис генерации учебных презентаций. Продуктовая цель: тема → содержательная, аккуратно спроектированная PPTX.

## Статус Phase 1

Создана основа проекта, строгий контракт и тесты. Исходная рабочая папка пуста; код n8n/Val Town не предоставлен. **Legacy snapshot отсутствует; совместимость с MVP не доказана.** Renderer не переносился и локальная генерация PPTX пока недоступна.

Текущая архитектура со слов владельца: Telegram → n8n FSM → Gemini → Parse Structure → Val Town/PptxGenJS → Telegram. n8n остаётся orchestration layer. Подробнее: [архитектура](docs/architecture.md).

## Установка и проверка

Node.js 24+, npm. В корне репозитория:

```sh
npm ci
npm run typecheck
npm test
# обе проверки:
npm run check
```

`npm run build` компилирует TypeScript в `dist/`. Production server и Telegram bot в Phase 1 не запускаются.

Программное использование после сборки:

```js
import { validatePresentation } from './dist/src/presentation/validator.js';
// input — разобранный JSON Gemini, trustedRequest — отдельные данные FSM.
const validated = validatePresentation(input, trustedRequest);
```

Это структурная проверка, не разрешение на render: нужны фактический реестр layouts, content QC, fitText и image QC.

## Переменные окружения

`.env.example` содержит только пустые `UNSPLASH_ACCESS_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `TELEGRAM_BOT_TOKEN`. Phase 1 не читает их и не делает запросы к провайдерам. Для будущих интеграций используйте локальный `.env` (игнорируется Git); никогда не добавляйте токены в fixtures или workflow export. Если старый Unsplash key раскрывался, его нужно отозвать у провайдера.

## Legacy и sample PPTX

Места снимков: `legacy/n8n/parse-structure.js`, `legacy/n8n/workflow.json`, `legacy/valtown/main.ts`. Сейчас этих файлов нет; см. [статус и порядок импорта](legacy/README.md).

Команды генерации sample PPTX пока нет: её добавят после сохранения оригинального renderer и эталонного результата. Не выдавайте synthetic contract fixtures за рабочие учебные презентации. PptxGenJS остаётся выбранным движком; зависимость добавляется при фактическом переносе.

Документы: [контракт](docs/json-contract.md), [layouts](docs/layouts.md), [правила качества](docs/quality-rules.md), [roadmap](docs/roadmap.md), [аудит](docs/audit.md).
