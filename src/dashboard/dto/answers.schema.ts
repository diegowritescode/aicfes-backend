import { z } from 'zod';

export const AnswerSchema = z.object({
  sessionId: z.string().min(1),
  questionIndex: z.number().int().min(0),
  area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']).optional(),
  dificultad: z.enum(['facil', 'media', 'alta']).optional(),
  selectedAnswer: z.string().optional(),
  isCorrect: z.boolean(),
});

export const AnswersArraySchema = z.array(AnswerSchema).min(1);

export const AnswersPayloadSchema = z.union([
  AnswersArraySchema,
  z.object({
    userId: z.string().optional(),
    answers: AnswersArraySchema,
  }),
]);

export type AnswerInput = z.infer<typeof AnswerSchema>;
