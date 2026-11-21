import { z } from 'zod';

export const AnswerSchema = z.object({
  sessionId: z.string().min(1),
  questionIndex: z.number().int().min(0),
  area: z.enum(['MAT', 'LC', 'CN', 'SOC', 'ING']).optional(),
  dificultad: z.enum(['facil', 'media', 'alta']).optional(),
  selectedAnswer: z.string().optional(),
  isCorrect: z.boolean(),
  /// Which stored item this answers. Optional so existing clients keep
  /// working, but without it the answer cannot be attributed and the
  /// item's quality stays unmeasured.
  itemId: z.string().min(1).optional(),
  /// Milliseconds the learner spent on this question.
  tiempoMs: z.number().int().min(0).max(600_000).optional(),
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
