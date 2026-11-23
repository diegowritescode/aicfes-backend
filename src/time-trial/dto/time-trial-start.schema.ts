import { z } from 'zod';

/* The caps are the point of this schema, not the shapes.
 *
 * Every question here is generated, and generating costs money. With
 * only `min(1)`, a single request could ask for a hundred thousand
 * and the quota would not notice until the bill arrived: the ceiling
 * has to be on the way in.
 *
 * Twenty is above the longest real mode (eight) with room to spare,
 * and two hours is longer than any honest trial. */
const MAXIMO_PREGUNTAS = 20;
const MAXIMO_SEGUNDOS = 2 * 60 * 60;

export const TimeTrialCustomSchema = z.object({
  area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']),
  dificultad: z.enum(['facil', 'media', 'alta']),
  timeLimitSeconds: z.number().int().min(60).max(MAXIMO_SEGUNDOS),
  questions: z.number().int().min(1).max(MAXIMO_PREGUNTAS),
});

export const TimeTrialStartSchema = z.object({
  modeId: z.string().optional(),
  custom: TimeTrialCustomSchema.optional(),
});

export type TimeTrialStartInput = z.infer<typeof TimeTrialStartSchema>;
