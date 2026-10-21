import { z } from 'zod';

function urlWithProtocol(protocols: string[]) {
  return z.url().refine((value) => {
    try {
      return protocols.includes(new URL(value).protocol);
    } catch {
      return false;
    }
  });
}

const postgresUrl = urlWithProtocol(['postgres:', 'postgresql:']);
const redisUrl = urlWithProtocol(['redis:', 'rediss:']);
const corsOrigin = z
  .string()
  .url()
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return (
        ['http:', 'https:'].includes(parsed.protocol) &&
        parsed.pathname === '/' &&
        !parsed.search &&
        !parsed.hash
      );
    } catch {
      return false;
    }
  });

const apiSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: postgresUrl,
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1),
  JWT_AUDIENCE: z.string().min(1),
  JWT_EXPIRES_IN: z.coerce.number().int().positive(),
  REDIS_URL: redisUrl,
  CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  CACHE_TIMEOUT_MS: z.coerce.number().int().min(1).max(5000).default(200),
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  LOGIN_RATE_TTL_SECONDS: z.coerce.number().int().positive().default(60),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(0),
  CORS_ORIGIN: corsOrigin.optional(),
});

const seedSchema = z.object({
  DATABASE_URL: postgresUrl,
  SEED_USER_EMAIL: z.email(),
  SEED_USER_PASSWORD: z.string().min(1),
});

export type ApiConfig = Readonly<z.infer<typeof apiSchema>>;
export type SeedConfig = Readonly<z.infer<typeof seedSchema>>;

export const API_CONFIG = Symbol('API_CONFIG');

/** Names the invalid variables and nothing else, so it is always safe to print. */
export class ConfigError extends Error {
  constructor(fields: string[]) {
    super(`Invalid environment fields: ${fields.join(', ')}`);
    this.name = 'ConfigError';
  }
}

function parseConfig<T extends z.ZodType>(schema: T, env: NodeJS.ProcessEnv): Readonly<z.infer<T>> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0] ?? 'environment'))),
    ].sort();
    throw new ConfigError(fields);
  }
  return Object.freeze(result.data);
}

export function loadApiConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return parseConfig(apiSchema, env);
}

export function loadSeedConfig(env: NodeJS.ProcessEnv = process.env): SeedConfig {
  return parseConfig(seedSchema, env);
}
