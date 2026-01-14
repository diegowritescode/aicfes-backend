import { z } from 'zod';

export const HeartbeatSchema = z.object({
  elapsedSeconds: z.number().int().min(0),
  endedAt: z.string().datetime().optional(),
});

export type HeartbeatInput = z.infer<typeof HeartbeatSchema>;
