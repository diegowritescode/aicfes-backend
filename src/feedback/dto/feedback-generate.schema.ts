import { z } from 'zod';

export const FeedbackGenerateSchema = z.object({
  sessionId: z.string().min(1),
  mode: z.enum(['generacion_libre', 'contrarreloj', 'tecnica']).optional(),
  focus: z.enum(['summary', 'strengths', 'weaknesses', 'plan']).optional(),
  language: z.string().default('es'),
  force: z.boolean().optional().default(false),
});

export type FeedbackGenerateInput = z.infer<typeof FeedbackGenerateSchema>;
