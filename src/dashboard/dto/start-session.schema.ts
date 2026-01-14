import { z } from 'zod';

export const StartSessionSchema = z.object({
  userId: z.string().optional(),
  timezone: z.string().optional(),
  mode: z.enum(['generacion_libre', 'contrarreloj', 'test']),
  area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']),
  dificultad: z.enum(['facil', 'media', 'alta']).optional(),
  tema: z.string().optional(),
  startedAt: z.string().datetime(),
});

export type StartSessionInput = z.infer<typeof StartSessionSchema>;
