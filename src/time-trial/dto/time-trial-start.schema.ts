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

/* A topic is free text that ends up inside a prompt and inside a
   `tags` lookup, so it is capped. Sixty characters is longer than any
   real topic («descomposicion en factores primos» is 35) and short
   enough that it cannot carry instructions. */
const MAXIMO_TEMA = 60;

export const TimeTrialCustomSchema = z.object({
  area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']),
  dificultad: z.enum(['facil', 'media', 'alta']),
  /* What makes the weekly plan actionable: the plan names a topic,
     and without this the drill could only be aimed at an area. The
     bank now filters on it and falls back to the area when the topic
     is thin, so a topic that is merely unstocked costs nothing. */
  tema: z.string().trim().min(1).max(MAXIMO_TEMA).optional(),
  timeLimitSeconds: z.number().int().min(60).max(MAXIMO_SEGUNDOS),
  questions: z.number().int().min(1).max(MAXIMO_PREGUNTAS),
});

export const TimeTrialStartSchema = z.object({
  modeId: z.string().optional(),
  custom: TimeTrialCustomSchema.optional(),
});

export type TimeTrialStartInput = z.infer<typeof TimeTrialStartSchema>;
