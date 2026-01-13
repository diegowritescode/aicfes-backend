import { z } from 'zod';

export const GenerateRequestSchema = z.object({
  area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']),
  dificultad: z.enum(['facil', 'media', 'alta']),
  tema: z.string().optional(),
  plantilla: z.string().optional(),
  n: z
    .number()
    .int()
    .min(1)
    .optional()
    .transform((v) => (v === undefined ? 1 : v)),
});

export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;
