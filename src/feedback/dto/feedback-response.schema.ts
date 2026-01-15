import { z } from 'zod';

export const FeedbackResponseSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.object({
    area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']).optional(),
    note: z.string().min(1),
  })).default([]),
  weaknesses: z.array(z.object({
    area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']).optional(),
    note: z.string().min(1),
  })).default([]),
  plan: z.array(z.object({
    title: z.string().min(1),
    detail: z.string().min(1),
  })).default([]),
  insights: z.object({
    avgTimePerQuestionSeconds: z.number().int().nonnegative(),
    accuracy: z.number().min(0).max(1),
    speedNote: z.string().min(1),
  }),
});

export type FeedbackResponse = z.infer<typeof FeedbackResponseSchema>;
