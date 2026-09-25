const tgData = $('Telegram Trigger').item.json.message;
const chatId = tgData.chat.id;
const rawText = typeof tgData.text === 'string' ? tgData.text : '';
const normalizedText = rawText.trim().toLocaleLowerCase('ru-RU');

// Supabase remains the source of the current dialogue state.
const session = $('Get a row').item.json || {};
const currentState = session.state || 'waiting_education_stage';

let replyText = '';
let replyMarkup = null;
let updateFields = {};
let isReady = false;

const educationStageByAnswer = {
  'школа': 'school',
  'колледж': 'college',
  'вуз': 'university',
  'университет': 'university',
};

const askTopic = 'Напишите тему презентации.';

if (currentState === 'waiting_education_stage') {
  const educationStage = educationStageByAnswer[normalizedText];

  if (!educationStage) {
    replyText = 'Выберите, где вы учитесь: школа, колледж или вуз.';
    replyMarkup = {
      keyboard: [[{ text: 'Школа' }, { text: 'Колледж' }, { text: 'Вуз' }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  } else if (educationStage === 'school') {
    updateFields = { education_stage: educationStage, state: 'waiting_school_class' };
    replyText = 'Напишите ваш класс, например: 8Г.';
    replyMarkup = { remove_keyboard: true };
  } else {
    updateFields = { education_stage: educationStage, state: 'waiting_course' };
    replyText = 'Напишите ваш курс, например: 2.';
    replyMarkup = { remove_keyboard: true };
  }
}
else if (currentState === 'waiting_school_class') {
  if (normalizedText.length === 0) {
    replyText = 'Класс не может быть пустым. Напишите его, например: 8Г.';
  } else {
    // rawText is preserved: user metadata must not be corrected or reformatted.
    updateFields = { school_class: rawText, student_group: rawText, state: 'waiting_topic' };
    replyText = askTopic;
  }
}
else if (currentState === 'waiting_course') {
  if (normalizedText.length === 0) {
    replyText = 'Курс не может быть пустым. Напишите его, например: 2.';
  } else {
    updateFields = { course: rawText, state: 'waiting_group' };
    replyText = 'Напишите вашу группу, например: ИС-21.';
  }
}
else if (currentState === 'waiting_group') {
  if (normalizedText.length === 0) {
    replyText = 'Группа не может быть пустой. Напишите её, например: ИС-21.';
  } else {
    updateFields = { student_group: rawText, state: 'waiting_topic' };
    replyText = askTopic;
  }
}
else if (currentState === 'waiting_topic') {
  if (normalizedText.length === 0) {
    replyText = 'Тема не может быть пустой. Напишите тему презентации.';
  } else {
    updateFields = { topic: rawText, state: 'waiting_subject' };
    replyText = 'Теперь укажите предмет, например: История, Экономика или Физика.';
  }
}
else if (currentState === 'waiting_subject') {
  if (normalizedText.length === 0) {
    replyText = 'Предмет не может быть пустым. Напишите название предмета.';
  } else {
    updateFields = { subject: rawText, state: 'waiting_slide_count' };
    replyText = 'Сколько слайдов нужно?';
    replyMarkup = {
      keyboard: [[{ text: '5' }, { text: '7' }, { text: '10' }, { text: '12' }, { text: '15' }]],
      resize_keyboard: true,
      one_time_keyboard: true,
    };
  }
}
else if (currentState === 'waiting_slide_count') {
  if (!/^[1-9]\d*$/.test(normalizedText)) {
    replyText = 'Введите целое положительное число слайдов, например: 10.';
  } else {
    updateFields = { slide_count: Number(normalizedText), state: 'waiting_name' };
    replyText = 'Напишите имя и фамилию, например: Иван Иванов.';
    replyMarkup = { remove_keyboard: true };
  }
}
else if (currentState === 'waiting_name') {
  if (normalizedText.length === 0) {
    replyText = 'Имя не может быть пустым. Напишите имя и фамилию.';
  } else {
    updateFields = { student_name: rawText, state: 'generating' };
    isReady = true;

    const isSchool = session.education_stage === 'school';
    const learnerLine = isSchool
      ? `🎓 Класс: ${session.school_class}`
      : `🎓 Курс: ${session.course}\n👥 Группа: ${session.student_group}`;

    replyText = `Готово. 🎯\n\n` +
      `📌 Тема: ${session.topic}\n` +
      `📚 Предмет: ${session.subject}\n` +
      `📊 Слайдов: ${session.slide_count}\n` +
      `👤 Имя: ${rawText}\n` +
      `${learnerLine}\n\n` +
      `🚀 Начинаю создание презентации...\n` +
      `🧠 Анализирую тему и создаю структуру...`;
  }
}
else {
  throw new Error(`Unsupported FSM state: ${currentState}`);
}

const educationContext = session.education_stage === 'school'
  ? { educationStage: 'school', schoolClass: session.school_class }
  : { educationStage: session.education_stage, course: session.course };

return [{
  json: {
    chatId,
    updateFields,
    replyText,
    replyMarkup,
    isReady,
    presentationRequest: isReady ? {
      topic: session.topic,
      subject: session.subject,
      slideCount: session.slide_count,
      studentName: rawText,
      group: session.student_group,
      style: 'deep_blue',
      educationContext,
    } : null,
  },
}];
