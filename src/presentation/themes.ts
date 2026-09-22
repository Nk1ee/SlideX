import type { ThemeId } from './types.js';

export type ThemeFamily = 'minimal' | 'dynamic' | 'business';

export type ThemeColors = {
  background: string;
  accent: string;
  title: string;
  subtitle: string;
  body: string;
  footer: string;
};

export type ThemeGeometry = {
  titleAccentWidth: number;
  dividerHeight: number;
};

export type PresentationTheme = {
  id: ThemeId;
  family: ThemeFamily;
  name: string;
  paletteName: string;
  description: string;
  colors: ThemeColors;
  geometry: ThemeGeometry;
};

export const PRESENTATION_THEMES = {
  deep_blue: {
    id: 'deep_blue',
    family: 'business',
    name: 'Деловой',
    paletteName: 'Глубокий синий',
    description: 'Строгая тёмная основа с холодным голубым акцентом.',
    colors: { background: '0A1128', accent: '38BDF8', title: 'FFFFFF', subtitle: 'CBD5E1', body: 'CBD5E1', footer: '94A3B8' },
    geometry: { titleAccentWidth: 0.15, dividerHeight: 0.03 },
  },
  minimal_light: {
    id: 'minimal_light',
    family: 'minimal',
    name: 'Минималистичный',
    paletteName: 'Светлый',
    description: 'Светлый фон, чистая иерархия и синий акцент.',
    colors: { background: 'F7F7F2', accent: '2563EB', title: '111827', subtitle: '4B5563', body: '374151', footer: '5F6875' },
    geometry: { titleAccentWidth: 0.06, dividerHeight: 0.015 },
  },
  minimal_graphite: {
    id: 'minimal_graphite',
    family: 'minimal',
    name: 'Минималистичный',
    paletteName: 'Графитовый',
    description: 'Спокойная тёмная основа с мягким голубым акцентом.',
    colors: { background: '17191D', accent: '93C5FD', title: 'F9FAFB', subtitle: 'D1D5DB', body: 'E5E7EB', footer: '9CA3AF' },
    geometry: { titleAccentWidth: 0.06, dividerHeight: 0.015 },
  },
  dynamic_violet: {
    id: 'dynamic_violet',
    family: 'dynamic',
    name: 'Динамичный',
    paletteName: 'Фиолетовый импульс',
    description: 'Контрастная тёмная палитра с выразительным фиолетовым акцентом.',
    colors: { background: '160F2D', accent: 'A78BFA', title: 'FFFFFF', subtitle: 'DDD6FE', body: 'EDE9FE', footer: 'C4B5FD' },
    geometry: { titleAccentWidth: 0.25, dividerHeight: 0.07 },
  },
  dynamic_coral: {
    id: 'dynamic_coral',
    family: 'dynamic',
    name: 'Динамичный',
    paletteName: 'Коралловый импульс',
    description: 'Тёплая контрастная палитра с коралловым акцентом.',
    colors: { background: '271217', accent: 'FB7185', title: 'FFF7ED', subtitle: 'FED7AA', body: 'FFE4E6', footer: 'FDA4AF' },
    geometry: { titleAccentWidth: 0.25, dividerHeight: 0.07 },
  },
  business_slate: {
    id: 'business_slate',
    family: 'business',
    name: 'Деловой',
    paletteName: 'Светлый сланец',
    description: 'Светлая профессиональная палитра с насыщенным синим акцентом.',
    colors: { background: 'F1F5F9', accent: '1D4ED8', title: '0F172A', subtitle: '334155', body: '334155', footer: '5B6879' },
    geometry: { titleAccentWidth: 0.15, dividerHeight: 0.03 },
  },
  business_emerald: {
    id: 'business_emerald',
    family: 'business',
    name: 'Деловой',
    paletteName: 'Тёмный изумруд',
    description: 'Сдержанная тёмно-зелёная палитра с ясным изумрудным акцентом.',
    colors: { background: '082F2A', accent: '34D399', title: 'ECFEFF', subtitle: 'A7F3D0', body: 'D1FAE5', footer: '6EE7B7' },
    geometry: { titleAccentWidth: 0.15, dividerHeight: 0.03 },
  },
} as const satisfies Record<ThemeId, PresentationTheme>;

export const PRESENTATION_THEME_OPTIONS: readonly PresentationTheme[] = Object.values(PRESENTATION_THEMES);

export function getPresentationTheme(id: ThemeId): PresentationTheme {
  return PRESENTATION_THEMES[id];
}
