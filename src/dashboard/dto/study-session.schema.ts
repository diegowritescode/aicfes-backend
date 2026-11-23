import { z } from 'zod';

export const StudySessionSchema = z.object({
  userId: z.string().optional(),
  timezone: z.string().optional(),
  mode: z.enum(['generacion_libre', 'contrarreloj', 'test', 'peaje']),
  area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']),
  dificultad: z.enum(['facil', 'media', 'alta']).optional(),
  tema: z.string().optional(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),
  correctQuestions: z.number().int().min(0),
});

export type StudySessionInput = z.infer<typeof StudySessionSchema>;
