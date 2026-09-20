# Pre-render quality gates

`contentValidation.ts` проверяет содержательную форму уже validated `Presentation`: лимиты заголовков/bullets/cards, provenance statistics/sources, quote и visual plan. Он возвращает диагностические issues и ничего не исправляет.

`layoutValidation.ts` проверяет план и registry renderer: первый слайд title, реализованность каждого layout, запрет image на sources/conclusion, editorial nature sources и повтор layout. Registry передаётся снаружи, потому что список целевых layouts не равен списку реально написанных renderer modules.

Оба gate работают после `validateAndNormalizePresentation`. Они не доказывают фактическую правдивость источника, смысловую релевантность изображения или визуальное отсутствие overlap — для этого нужны content provider checks и post-render PPTX QC.

`pptxValidation.ts` проверяет уже созданный binary: читаемый ZIP, обязательные PPTX entries, точное количество slide XML, базовую непустоту XML и media при ожидаемых images. Это structural gate; визуальный overlap и clipping по-прежнему требуют render-to-image проверки.
