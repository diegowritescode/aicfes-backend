import { z } from 'zod';

export const CompleteSessionSchema = z.object({
  userId: z.string().optional(),
  endedAt: z.string().datetime(),
  durationSeconds: z.number().int().min(0),
  totalQuestions: z.number().int().min(1),
  correctQuestions: z.number().int().min(0),
  areaSummary: z
    .array(
      z.object({
        area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']),
        totalQuestions: z.number().int().min(0),
        correctQuestions: z.number().int().min(0),
      }),
    )
    .optional(),
});

export type CompleteSessionInput = z.infer<typeof CompleteSessionSchema>;
