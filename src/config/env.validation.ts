import { z } from 'zod';

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-5-mini'),
  PORT: z.string().default('3000'),
  MAX_ITEMS: z.string().default('5'),
  MAX_RETRIES: z.string().default('2'),
  BODY_LIMIT: z.string().default('1mb'),
  CORS_ORIGIN: z.string().default('*'),
});

export function validateEnv(config: Record<string, any>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('Invalid environment:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  return result.data;
}
