# Legacy snapshot

Получен от владельца 2026-09-20 и сохранён в D:/project111/slidex.

- n8n/workflow.json: полный экспорт из 16 узлов, очищенный для Git.
- n8n/parse-structure.js, fsm-engine.js, quality-control-gate.js: точный текст jsCode соответствующих узлов.
- valtown/main.ts: побайтовая копия присланного renderer, PptxGenJS 3.12.0, Deno API.
- manifest.json: происхождение, версии узлов, SHA-256 и полный список изменений при очистке.

Точные оригиналы лежат в legacy/private/ и исключены из Git. Это НЕ зашифрованное хранилище: workflow содержит раскрытый Gemini key. Не публиковать этот каталог. Ключ нужно отозвать у провайдера и заменить через n8n credentials; live credentials этим аудитом не менялись.

В tracked workflow заменены API-key header, credential references, webhook IDs, deployment URL; удалены pinData/meta/id/versionId; active=false. Это архив, не готовый deployment export. Перед восстановлением нужны реальные credentials и URL. Логика jsCode и prompt сохранена. main.ts не исправлялся.

Characterization tests фиксируют известное поведение исторического кода, включая дефекты. Их успешность не означает соответствие MVP новым требованиям. Legacy immutable; исправления будущего этапа вносятся в src/.

Нет эталонного PPTX, runtime capture и доказательства идентичности присланной версии live deployment. Подробности: ../docs/legacy-audit.md.
