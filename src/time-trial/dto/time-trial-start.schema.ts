import { z } from 'zod';

export const TimeTrialCustomSchema = z.object({
  area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']),
  dificultad: z.enum(['facil', 'media', 'alta']),
  timeLimitSeconds: z.number().int().min(60),
  questions: z.number().int().min(1),
});

export const TimeTrialStartSchema = z.object({
  modeId: z.string().optional(),
  custom: TimeTrialCustomSchema.optional(),
});

export type TimeTrialStartInput = z.infer<typeof TimeTrialStartSchema>;
