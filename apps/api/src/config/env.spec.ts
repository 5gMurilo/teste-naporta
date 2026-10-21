import { ConfigError, loadApiConfig, loadSeedConfig } from './env.js';

const validApiEnv = (): NodeJS.ProcessEnv => ({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost/db',
  JWT_SECRET: 'a'.repeat(32),
  JWT_ISSUER: 'naporta',
  JWT_AUDIENCE: 'naporta-web',
  JWT_EXPIRES_IN: '3600',
  REDIS_URL: 'rediss://localhost:6379',
});

describe('loadApiConfig', () => {
  it('applies documented defaults and accepts a single CORS origin', () => {
    const config = loadApiConfig({ ...validApiEnv(), CORS_ORIGIN: 'https://app.example.test' });
    expect(config).toMatchObject({
      NODE_ENV: 'test',
      PORT: 3000,
      CACHE_TTL_SECONDS: 60,
      CACHE_TIMEOUT_MS: 200,
      CORS_ORIGIN: 'https://app.example.test',
    });
  });

  it.each(['development', 'test', 'production'])('accepts NODE_ENV %s', (nodeEnv) => {
    expect(loadApiConfig({ ...validApiEnv(), NODE_ENV: nodeEnv }).NODE_ENV).toBe(nodeEnv);
  });

  it('rejects an unsupported NODE_ENV', () => {
    expect(() => loadApiConfig({ ...validApiEnv(), NODE_ENV: 'staging' })).toThrow('NODE_ENV');
  });

  it.each(['0', '65536', '1.5', 'invalid'])('rejects PORT %s', (port) => {
    expect(() => loadApiConfig({ ...validApiEnv(), PORT: port })).toThrow('PORT');
  });

  it.each(['1', '65535'])('accepts PORT boundary %s', (port) => {
    expect(loadApiConfig({ ...validApiEnv(), PORT: port }).PORT).toBe(Number(port));
  });

  it.each(['http://localhost/db', 'invalid'])('rejects non-PostgreSQL DATABASE_URL %s', (url) => {
    expect(() => loadApiConfig({ ...validApiEnv(), DATABASE_URL: url })).toThrow('DATABASE_URL');
  });

  it.each([undefined, 'too-short'])('rejects missing or short JWT_SECRET', (secret) => {
    const env = validApiEnv();
    if (secret === undefined) delete env.JWT_SECRET;
    else env.JWT_SECRET = secret;
    expect(() => loadApiConfig(env)).toThrow('JWT_SECRET');
  });

  it('rejects a 31 character JWT_SECRET and accepts 32', () => {
    expect(() => loadApiConfig({ ...validApiEnv(), JWT_SECRET: 'a'.repeat(31) })).toThrow(
      'Invalid environment fields: JWT_SECRET',
    );
    expect(loadApiConfig({ ...validApiEnv(), JWT_SECRET: 'a'.repeat(32) }).JWT_SECRET).toBe(
      'a'.repeat(32),
    );
  });

  it('rejects empty JWT_ISSUER', () => {
    const issuer = '';
    expect(() => loadApiConfig({ ...validApiEnv(), JWT_ISSUER: issuer })).toThrow('JWT_ISSUER');
  });

  it('rejects empty JWT_AUDIENCE', () => {
    const audience = '';
    expect(() => loadApiConfig({ ...validApiEnv(), JWT_AUDIENCE: audience })).toThrow(
      'JWT_AUDIENCE',
    );
  });

  it.each(['0', '-1', '1.5', 'invalid'])('rejects JWT_EXPIRES_IN %s', (ttl) => {
    expect(() => loadApiConfig({ ...validApiEnv(), JWT_EXPIRES_IN: ttl })).toThrow(
      'JWT_EXPIRES_IN',
    );
  });

  it.each(['http://localhost:6379', 'invalid'])('rejects non-Redis REDIS_URL %s', (url) => {
    expect(() => loadApiConfig({ ...validApiEnv(), REDIS_URL: url })).toThrow('REDIS_URL');
  });

  it.each(['0', '-1', '1.5'])('rejects CACHE_TTL_SECONDS %s', (ttl) => {
    expect(() => loadApiConfig({ ...validApiEnv(), CACHE_TTL_SECONDS: ttl })).toThrow(
      'CACHE_TTL_SECONDS',
    );
  });

  it.each(['0', '5001', '1.5'])('rejects CACHE_TIMEOUT_MS %s', (timeout) => {
    expect(() => loadApiConfig({ ...validApiEnv(), CACHE_TIMEOUT_MS: timeout })).toThrow(
      'CACHE_TIMEOUT_MS',
    );
  });

  it('does not include invalid secret values in errors', () => {
    const sentinel = 'sentinel-secret-value';
    let message = '';
    try {
      loadApiConfig({ ...validApiEnv(), JWT_SECRET: sentinel });
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('JWT_SECRET');
    expect(message).not.toContain(sentinel);
  });

  it('does not require seed credentials at API runtime', () => {
    expect(loadApiConfig(validApiEnv()).DATABASE_URL).toBe('postgresql://localhost/db');
  });

  it('rejects a CORS URL that is not a single origin', () => {
    expect(() =>
      loadApiConfig({ ...validApiEnv(), CORS_ORIGIN: 'https://app.example.test/path' }),
    ).toThrow('CORS_ORIGIN');
  });

  it.each(['1', '5000'])('accepts CACHE_TIMEOUT_MS boundary %s', (timeout) => {
    expect(loadApiConfig({ ...validApiEnv(), CACHE_TIMEOUT_MS: timeout }).CACHE_TIMEOUT_MS).toBe(
      Number(timeout),
    );
  });
});

describe('loadSeedConfig', () => {
  it('requires an email and non-empty seed password', () => {
    expect(
      loadSeedConfig({
        DATABASE_URL: 'postgresql://localhost/db',
        SEED_USER_EMAIL: 'demo@example.test',
        SEED_USER_PASSWORD: 'demo-password',
      }),
    ).toMatchObject({ SEED_USER_EMAIL: 'demo@example.test', SEED_USER_PASSWORD: 'demo-password' });
  });

  it.each([undefined, ''])('rejects missing or empty seed password', (password) => {
    const env: NodeJS.ProcessEnv = {
      DATABASE_URL: 'postgresql://localhost/db',
      SEED_USER_EMAIL: 'demo@example.test',
    };
    if (password !== undefined) env.SEED_USER_PASSWORD = password;
    expect(() => loadSeedConfig(env)).toThrow('SEED_USER_PASSWORD');
  });

  it('rejects missing or malformed seed email', () => {
    expect(() =>
      loadSeedConfig({
        DATABASE_URL: 'postgresql://localhost/db',
        SEED_USER_PASSWORD: 'demo-password',
      }),
    ).toThrow('SEED_USER_EMAIL');
    expect(() =>
      loadSeedConfig({
        DATABASE_URL: 'postgresql://localhost/db',
        SEED_USER_EMAIL: 'not-an-email',
        SEED_USER_PASSWORD: 'demo-password',
      }),
    ).toThrow('SEED_USER_EMAIL');
  });
});

describe('ConfigError', () => {
  it('is thrown for invalid input and names only the offending variables, never their values', () => {
    const attempt = () =>
      loadApiConfig({
        ...validApiEnv(),
        JWT_SECRET: 'too-short-secret-value',
        DATABASE_URL: 'not-a-url',
      });

    expect(attempt).toThrow(ConfigError);
    expect(attempt).toThrow('Invalid environment fields: DATABASE_URL, JWT_SECRET');
    expect(attempt).not.toThrow(/too-short-secret-value|not-a-url/);
  });

  it('reports a missing variable the same way', () => {
    const { JWT_SECRET: _omitted, ...withoutSecret } = validApiEnv();

    expect(() => loadApiConfig(withoutSecret)).toThrow('Invalid environment fields: JWT_SECRET');
  });
});
