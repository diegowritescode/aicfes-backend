import { z } from 'zod';

export const GenerateMixedSectionSchema = z.object({
  area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']),
  dificultad: z.enum(['facil', 'media', 'alta']),
  n: z.number().int().min(1),
  tema: z.string().optional(),
  plantilla: z.string().optional(),
});

export const GenerateMixedSchema = z.object({
  sections: z.array(GenerateMixedSectionSchema).min(1),
  shuffle: z.boolean().optional().default(true),
  session: z
    .object({
      create: z.boolean().optional().default(false),
      mode: z.enum(['generacion_libre', 'contrarreloj', 'test']).optional(),
      startedAt: z.string().datetime().optional(),
      timezone: z.string().optional(),
      userId: z.string().optional(),
      seedAreaSummary: z.boolean().optional().default(true),
    })
    .optional(),
});

export type GenerateMixedInput = z.infer<typeof GenerateMixedSchema>;
