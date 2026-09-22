# SlideX

SlideX — Telegram-сервис для генерации учебных презентаций. Цель продукта: пользователь задаёт тему, а система возвращает содержательный и аккуратно сверстанный PPTX.

## Где мы сейчас

Рабочий MVP остаётся в n8n + Gemini + Val Town. Его исходники сохранены в `legacy/`. Локальный TypeScript-проект постепенно получает контракт, проверку данных, image pipeline и PPTX renderer. Подключение нового renderer к n8n ещё не выполнено; локальная генерация не равна production-переключению.

Текущая цепочка MVP: Telegram → n8n FSM → Gemini → Parse Structure → Val Town/PptxGenJS → Telegram. Сессии FSM хранятся в Supabase. [Архитектура](docs/architecture.md) и [аудит legacy](docs/legacy-audit.md) объясняют детали и расхождения.

Локальный renderer уже поддерживает `title`, `sources`, `conclusion`, `definition`, `hero`, `quote` и `image_text`. Остальные layout из [контракта](docs/json-contract.md) пока отклоняются явно. Renderer не создаёт учебное содержание и не исправляет данные пользователя.

## Установка и тесты

Нужны Node.js 24+ и npm. В корне репозитория:

```sh
npm ci
npm run check
```

`npm run check` выполняет проверку типов, сборку и тесты. `npm run build` создаёт JavaScript в `dist/`. Тесты провайдеров используют подставные ответы и не требуют ключей.

## Пробные PPTX

```sh
npm run sample:title
npm run sample:image
```

Первый файл появится как `work/title-sample.pptx`. Вторая команда обращается к открытому Wikimedia Commons API, отбирает изображение по visual-плану и создаёт `work/image-sample.pptx`. Оба файла учебно-технические samples, они не выдаются за готовые презентации. Папка `work/` и все PPTX исключены из Git. Для `sample:image` нужен доступ к Wikimedia; ключ не нужен.

## Ключи и секреты

`.env.example` содержит пустые имена переменных. Создавайте локальный `.env` только при реальной интеграции. `UNSPLASH_ACCESS_KEY` понадобится для живой проверки Unsplash. Wikimedia и локальные тесты работают без ключей. Не вставляйте ключи в чат, исходники, fixtures, workflow export или GitHub. У Node.js нет автоматического чтения `.env` в текущих npm-командах: будущий production entrypoint должен загрузить окружение явно.

## Что читать дальше

- [Правила проекта](AGENTS.md)
- [JSON-контракт](docs/json-contract.md)
- [Layouts](docs/layouts.md)
- [Качество и ограничения](docs/quality-rules.md)
- [Изображения](src/images/README.md)
- [Roadmap](docs/roadmap.md)

Исходники старого MVP находятся в `legacy/n8n/` и `legacy/valtown/`; [описание снимка](legacy/README.md) объясняет, что было очищено от секретов. Историческая проблема перекрытия последних слайдов пока не воспроизведена на исходном проблемном файле.
