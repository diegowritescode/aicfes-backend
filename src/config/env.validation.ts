import { z } from 'zod';

const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().default('gpt-5-mini'),
  OPENAI_TIMEOUT_MS: z.string().default('180000'),
  OPENAI_FEEDBACK_MODEL: z.string().default('gpt-4o-mini'),
  FEEDBACK_COOLDOWN_MINUTES: z.string().default('20'),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES: z.string().default('7d'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.string().default('30'),
  REFRESH_COOKIE_NAME: z.string().default('refresh_token'),
  ACCESS_COOKIE_NAME: z.string().default('access_token'),
  PORT: z.string().default('3000'),
  MAX_ITEMS: z.string().default('25'),
  MAX_RETRIES: z.string().default('2'),
  BODY_LIMIT: z.string().default('1mb'),
  CORS_ORIGIN: z.string().default('*'),
  /* Optional, and the moderation routes are closed when it is absent
     rather than open. Set on the server over SSH like the other
     secrets. */
  MODERACION_TOKEN: z.string().optional(),
  /* Email, for telling a moderator that a report arrived. Both
     optional: without them nothing is sent and the queue is still
     readable in the app. */
  RESEND_API_KEY: z.string().optional(),
  MODERACION_CORREO: z.string().optional(),
  CORREO_REMITENTE: z.string().optional(),
});

export function validateEnv(config: Record<string, any>) {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    console.error('Invalid environment:', result.error.format());
    throw new Error('Invalid environment variables');
  }
  return result.data;
}
