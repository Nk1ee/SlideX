# SlideX Val Town renderer v2

Эта папка содержит новый HTTP renderer. Он использует канонический контракт SlideX, локальные layouts, image pipeline и post-render PPTX QC. Старый рабочий legacy/valtown/main.ts не изменяется и остаётся rollback-версией.

## Где находится код

- ../../src/integrations/valtownRenderer.ts — проверяемый HTTP handler.
- renderer-v2.entry.ts — исходный Val Town entrypoint.
- ../../scripts/build-valtown-project.mjs — воспроизводимая сборка deploy-папки.
- project/ — готовый проект для загрузки в Val Town.
- example-request.json — минимальный корректный POST body без изображений.

После изменения renderer выполните:

~~~powershell
npm run valtown:build
npm run check
~~~

valtown:build сначала компилирует TypeScript, затем пересоздаёт project/ из dist/src. Скрипт проверяет целевой путь перед рекурсивной очисткой.

## Зачем в запросе два объекта

POST body имеет форму:

~~~json
{
  "request": {
    "topic": "Тема из FSM",
    "subject": "Предмет из FSM",
    "studentName": "Имя из FSM",
    "group": "Группа из FSM",
    "slideCount": 10,
    "style": "deep_blue",
    "educationContext": {
      "educationStage": "school",
      "schoolClass": "8Г"
    }
  },
  "payload": {
    "chatId": "telegram-chat-id",
    "presentation": {},
    "slides": []
  }
}
~~~

request — доверенные пользовательские данные из FSM. payload — structured output Gemini. Renderer сравнивает metadata до нормализации и отклоняет запрос, если Gemini изменил хотя бы одно поле. educationContext передаётся только когда он есть.

## Переменные Val Town

Обязательная:

- SLIDEX_RENDER_TOKEN — длинный случайный общий секрет между n8n и Val Town. В n8n хранить в credential типа Header Auth, а не в workflow JSON.

Для изображений:

- UNSPLASH_ACCESS_KEY — необязателен; без него остаётся Wikimedia Commons.
- GEMINI_API_KEY и GEMINI_QC_MODEL — необязательная пара для AI-проверки изображения. Если ключ задан без модели, endpoint вернёт 503, чтобы проверка не отключилась молча.
- SLIDEX_WIKIMEDIA_USER_AGENT — необязательная идентифицирующая строка для Wikimedia API.

Сгенерировать render token локально можно командой:

~~~powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
~~~

Результат хранится только в Val Town environment и n8n credential. Его нельзя добавлять в .env.example, workflow export, чат или Git.

## Развёртывание рядом с legacy

1. В Val Town создайте отдельный val, например slidex-renderer-v2. Не заменяйте legacy val.
2. Перенесите содержимое project/ с сохранением структуры папок.
3. Добавьте HTTP trigger файлу main.ts.
4. Создайте environment variables из предыдущего раздела.
5. Откройте URL методом GET. Ответ должен содержать ok=true, version=2 и флаги конфигурации без значений секретов.
6. Отправьте example-request.json методом POST с заголовками Content-Type: application/json и Authorization: Bearer <SLIDEX_RENDER_TOKEN>.
7. Проверьте MIME, открытие PPTX и число слайдов.
8. Только после этого создайте тестовую копию n8n workflow и направьте её на v2 URL.

Val Town официально использует Deno и web-standard Request/Response; npm-зависимости в project/deno.json закреплены полными версиями. Относительные импорты поддерживаются внутри папки val.

## Настройка HTTP Request в n8n

Для узла renderer:

- Method: POST
- URL: новый v2 HTTP URL
- Authentication: Header Auth credential с именем Authorization и значением Bearer <token>
- Send Body: true
- Body Content Type: JSON
- Response Format: File
- Retry On Fail: true, Max Tries: 3, Wait Between Tries: 5000

Body должен строиться явно, чтобы strict schema не получила служебные поля FSM:

~~~javascript
={{
  (() => {
    const fsm = $('FSM Engine').first().json.presentationRequest;
    return {
      request: {
        topic: fsm.topic,
        subject: fsm.subject,
        studentName: fsm.studentName,
        group: fsm.group,
        slideCount: fsm.slideCount,
        style: fsm.style,
        ...(fsm.educationContext ? { educationContext: fsm.educationContext } : {})
      },
      payload: $('Parse Structure V2').first().json
    };
  })()
}}
~~~

Legacy-узел Parse Structure несовместим с v2: он меняет layout первого/последнего слайда, режет массивы, создаёт fallback и теряет visual.type, visual.concept, columns, steps, definition, structured sources и другие обязательные поля. Новый узел находится в `../n8n/parse-structure-v2.js`: он только парсит structured JSON, проверяет metadata и точное число слайдов и не придумывает контент.

## Ответы endpoint

- 200 — PPTX binary с правильным MIME.
- 400 INVALID_JSON — тело не является JSON.
- 401 UNAUTHORIZED — неверный общий token.
- 413 PAYLOAD_TOO_LARGE — тело больше 2 MiB.
- 415 UNSUPPORTED_MEDIA_TYPE — не application/json.
- 422 CONTRACT_VALIDATION_FAILED — поля не совпадают со schema.
- 422 QUALITY_GATE_REJECTED — нарушены metadata/content/layout правила.
- 422 RENDER_REJECTED — текст не помещается или изображение не найдено/не прошло проверку.
- 500 POST_RENDER_QC_FAILED — сгенерированный ZIP/PPTX не прошёл внутреннюю проверку.
- 503 SERVER_NOT_CONFIGURED — обязательная server-конфигурация неполна.

Renderer не создаёт fallback bullets, statistics, quotes, sources или layouts. Ошибка возвращается в n8n для контролируемой repair-generation.
