import type { z } from 'zod';
import type { layoutSchema, presentationSchema, slideSchema, sourceSchema, themeIdSchema, userRequestSchema, visualSchema } from './schema.js';

export type Layout = z.infer<typeof layoutSchema>;
export type Presentation = z.infer<typeof presentationSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type ThemeId = z.infer<typeof themeIdSchema>;
export type UserRequest = z.infer<typeof userRequestSchema>;
export type Visual = z.infer<typeof visualSchema>;
