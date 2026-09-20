import type { Layout, Presentation, Slide, UserRequest } from '../../src/presentation/types.js';

// Synthetic structural fixtures, not Gemini outputs or verified teaching material.
export const requests: UserRequest[] = [
  { topic: 'Нейронные сети: принцип работы и основные области применения', subject: 'Информатика', studentName: 'Тест', group: '1', slideCount: 10, style: 'deep_blue' },
  { topic: 'Искусственный интеллект в современном образовании: возможности, риски и перспективы', subject: 'Информатик', studentName: 'Ох', group: '4', slideCount: 13, style: 'deep_blue' },
  { topic: 'Причины и последствия реформ Петра I', subject: 'История', studentName: 'Тест', group: '1', slideCount: 10, style: 'deep_blue' },
];

export function slideFixture(layout: Layout, number = 1): Slide {
  return {
    number,
    type: layout === 'title' || layout === 'conclusion' || layout === 'sources' ? layout : 'content',
    layout, title: 'Структурная тестовая фикстура', subtitle: 'Тестовое утверждение',
    bullets: ['Тестовый пункт'],
    cards: [1, 2, 3].map((i) => ({ title: `Вывод ${i}`, text: 'Тестовое описание' })),
    columns: [1, 2].map((i) => ({ title: `Колонка ${i}`, items: ['Тестовый пункт'] })),
    comparison: { left: { title: 'A', items: ['A'] }, right: { title: 'B', items: ['B'] } },
    statistics: null, timeline: [{ date: 'Этап A', title: 'Тестовый этап', text: 'Описание' }],
    steps: [{ title: 'Тестовый шаг', text: 'Описание' }],
    definition: { term: 'Тест', text: 'Структурная фикстура' }, quote: null,
    visual: { needed: false, type: 'none', concept: '', query_en: '', placement: 'supporting' },
    sources: [],
  };
}

export function presentationFixture(request: UserRequest): Presentation {
  return {
    chatId: 'fixture-chat',
    presentation: { fullTopic: request.topic, displayTitle: 'Тестовый заголовок', subject: request.subject,
      studentName: request.studentName, group: request.group, slideCount: request.slideCount, style: request.style, language: 'ru' },
    slides: Array.from({ length: request.slideCount }, (_, index) => slideFixture(index === 0 ? 'title' : index === request.slideCount - 1 ? 'conclusion' : index % 2 ? 'definition' : 'process', index + 1)),
  };
}
