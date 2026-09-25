export type TypographyRole = 'COVER_TITLE' | 'HERO' | 'TITLE' | 'SUBTITLE' | 'BODY' | 'LABEL' | 'CAPTION' | 'NUMBER';

export type TypographyStyle = {
  fontFace: string;
  preferredFontSize: number;
  minFontSize: number;
  bold: boolean;
};

/**
 * One source of truth for renderer typography.
 * Values are inherited from the current Val Town visual language and are provisional
 * until a specific institution's formatting standard is supplied.
 */
export const DEFAULT_TYPOGRAPHY: Readonly<Record<TypographyRole, TypographyStyle>> = {
  COVER_TITLE: { fontFace: 'Arial', preferredFontSize: 44, minFontSize: 34, bold: true },
  HERO: { fontFace: 'Arial', preferredFontSize: 30, minFontSize: 24, bold: true },
  TITLE: { fontFace: 'Arial', preferredFontSize: 26, minFontSize: 22, bold: true },
  SUBTITLE: { fontFace: 'Arial', preferredFontSize: 18, minFontSize: 16, bold: false },
  BODY: { fontFace: 'Arial', preferredFontSize: 16, minFontSize: 14, bold: false },
  LABEL: { fontFace: 'Arial', preferredFontSize: 11, minFontSize: 10, bold: true },
  CAPTION: { fontFace: 'Arial', preferredFontSize: 10, minFontSize: 9, bold: false },
  NUMBER: { fontFace: 'Arial', preferredFontSize: 34, minFontSize: 26, bold: true },
};

export function typographyFor(role: TypographyRole, overrides: Partial<TypographyStyle> = {}): TypographyStyle {
  return { ...DEFAULT_TYPOGRAPHY[role], ...overrides };
}

export function assertTypographyConfig(config: Readonly<Record<TypographyRole, TypographyStyle>>): void {
  for (const [role, style] of Object.entries(config)) {
    if (!style.fontFace.trim()) throw new Error(`${role} fontFace must not be empty`);
    if (style.preferredFontSize <= 0 || style.minFontSize <= 0) throw new Error(`${role} font sizes must be positive`);
    if (style.minFontSize > style.preferredFontSize) throw new Error(`${role} minFontSize cannot exceed preferredFontSize`);
  }
}
