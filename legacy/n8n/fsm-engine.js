const tgData = $('Telegram Trigger').item.json.message;
const chatId = tgData.chat.id;
const userText = (tgData.text || '').trim();

// Забираем текущее состояние из ноды Get a row
const session = $('Get a row').item.json || {};
const currentState = session.state || 'waiting_topic';

let nextState = currentState;
let replyText = '';
let replyMarkup = null;
let updateFields = {};
let isReady = false;

if (currentState === 'waiting_topic') {
  updateFields = { topic: userText, state: 'waiting_subject' };
  replyText = 'Отлично.\n\nТеперь укажи предмет (например: История, Экономика, Физика).';
} 
else if (currentState === 'waiting_subject') {
  updateFields = { subject: userText, state: 'waiting_slide_count' };
  replyText = 'Сколько слайдов нужно?';
  replyMarkup = {
    keyboard: [
      [{ text: '5' }, { text: '7' }, { text: '10' }, { text: '12' }, { text: '15' }]
    ],
    resize_keyboard: true,
    one_time_keyboard: true
  };
} 
else if (currentState === 'waiting_slide_count') {
  const count = parseInt(userText) || 10;
  updateFields = { slide_count: count, state: 'waiting_name' };
  replyText = 'Напиши имя и фамилию (например: Иван Иванов).';
  replyMarkup = { remove_keyboard: true };
} 
else if (currentState === 'waiting_name') {
  updateFields = { student_name: userText, state: 'waiting_group' };
  replyText = 'Напиши номер группы (например: 24138).';
} 
else if (currentState === 'waiting_group') {
  updateFields = { student_group: userText, state: 'generating' };
  isReady = true;

  replyText = `Готово. 🎯\n\n` +
    `📌 Тема: ${session.topic}\n` +
    `📚 Предмет: ${session.subject}\n` +
    `📊 Слайдов: ${session.slide_count || 10}\n` +
    `👤 Студент: ${session.student_name}\n` +
    `👥 Группа: ${userText}\n\n` +
    `🚀 Начинаю создание презентации...\n` +
    `🧠 Анализирую тему и создаю структуру...`;
}

return [{
  json: {
    chatId,
    updateFields,
    replyText,
    replyMarkup,
    isReady,
    presentationRequest: isReady ? {
      chatId,
      topic: session.topic,
      subject: session.subject,
      slideCount: session.slide_count || 10,
      studentName: session.student_name,
      group: userText,
      style: 'deep_blue',
      language: 'ru'
    } : null
  }
}];