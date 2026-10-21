import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url().refine((value) => {
    try {
      return ['postgres:', 'postgresql:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
});

export function loadConfig() {
  const result = schema.safeParse(process.env);
  if (!result.success) throw new Error(`Invalid environment: ${result.error.message}`);
  return result.data;
}
