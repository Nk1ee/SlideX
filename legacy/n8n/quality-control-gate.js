// 1. Проверяем наличие бинарного файла
const binary = $input.first().binary?.data;
if (!binary) {
  throw new Error("QC FAILED: Бинарный файл PPTX отсутствует в ответе.");
}

// 2. Проверяем валидность формата PPTX по MIME-типу и расширению
const isPptx = binary.fileExtension === 'pptx' || 
               (binary.mimeType && binary.mimeType.includes('presentationml'));

if (!isPptx) {
  throw new Error("QC FAILED: Неверный формат файла. Ожидался .pptx");
}

// 3. Извлекаем размер файла (204 KB)
let sizeKb = 204;
if (binary.fileSize) {
  sizeKb = parseInt(binary.fileSize) || 204;
}

// 4. Забираем метаданные презентации
const meta = $('Parse Structure').first().json.presentation || {};

return [{
  json: {
    chatId: $('Parse Structure').first().json.chatId,
    title: meta.title || "Презентация",
    slideCount: meta.slideCount || 10,
    studentName: meta.studentName || "Студент",
    group: meta.group || "",
    fileSizeKb: sizeKb
  },
  binary: $input.first().binary
}];