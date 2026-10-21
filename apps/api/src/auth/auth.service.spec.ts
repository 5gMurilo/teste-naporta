import { jest } from '@jest/globals';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { InvalidCredentialsError } from '../common/errors/domain-errors.js';
import { loadApiConfig } from '../config/env.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import { loginRequestSchema } from './auth.schemas.js';
import { AuthService } from './auth.service.js';

const config = loadApiConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost/db',
  JWT_SECRET: 's'.repeat(32),
  JWT_ISSUER: 'naporta-test',
  JWT_AUDIENCE: 'naporta-web-test',
  JWT_EXPIRES_IN: '900',
  REDIS_URL: 'redis://localhost:6379',
});

const jwt = new JwtService({
  secret: config.JWT_SECRET,
  signOptions: {
    algorithm: 'HS256',
    expiresIn: config.JWT_EXPIRES_IN,
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  },
});

async function createService(user: { id: string; email: string; passwordHash: string } | null) {
  const findUnique = jest.fn(async (_args: unknown) => user);
  const service = new AuthService(
    { user: { findUnique } } as unknown as PrismaService,
    jwt,
    config,
  );
  return { service, findUnique };
}

describe('AuthService.login', () => {
  it('issues an HS256 bearer token with minimal claims and the configured lifetime', async () => {
    const passwordHash = await argon2.hash('correct horse');
    const { service, findUnique } = await createService({
      id: '8d1c9f7e-6a58-4d7e-9a53-2a1f2d6a0c11',
      email: 'demo@example.test',
      passwordHash,
    });

    const result = await service.login({ email: 'demo@example.test', password: 'correct horse' });

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'demo@example.test' } }),
    );
    expect(result).toMatchObject({ tokenType: 'Bearer', expiresIn: 900 });
    const header = JSON.parse(
      Buffer.from(result.accessToken.split('.')[0] ?? '', 'base64url').toString(),
    );
    expect(header.alg).toBe('HS256');
    const claims = await jwt.verifyAsync(result.accessToken, {
      algorithms: ['HS256'],
      issuer: 'naporta-test',
      audience: 'naporta-web-test',
    });
    expect(Object.keys(claims).sort()).toEqual(['aud', 'email', 'exp', 'iat', 'iss', 'sub']);
    expect(claims.sub).toBe('8d1c9f7e-6a58-4d7e-9a53-2a1f2d6a0c11');
    expect(claims.exp - claims.iat).toBe(900);
    expect(JSON.stringify(claims)).not.toMatch(/correct horse|argon2/);
  });

  it('rejects an unknown email and a wrong password with the same error', async () => {
    const passwordHash = await argon2.hash('correct horse');
    const unknown = await createService(null);
    const wrong = await createService({ id: 'id', email: 'demo@example.test', passwordHash });

    const failures = await Promise.all([
      unknown.service
        .login({ email: 'nobody@example.test', password: 'correct horse' })
        .catch((e) => e),
      wrong.service.login({ email: 'demo@example.test', password: 'wrong' }).catch((e) => e),
    ]);

    for (const failure of failures) expect(failure).toBeInstanceOf(InvalidCredentialsError);
    expect(failures[0].detail).toBe(failures[1].detail);
    expect(failures[0].code).toBe('INVALID_CREDENTIALS');
  });

  it('does not trim the password before verification', async () => {
    const passwordHash = await argon2.hash('secret');
    const { service } = await createService({ id: 'id', email: 'demo@example.test', passwordHash });

    await expect(
      service.login({ email: 'demo@example.test', password: ' secret ' }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe('loginRequestSchema', () => {
  it('trims and lowercases the email but keeps the password untouched', () => {
    expect(loginRequestSchema.parse({ email: '  Demo@Example.TEST ', password: ' p ' })).toEqual({
      email: 'demo@example.test',
      password: ' p ',
    });
  });

  it.each([
    ['empty password', { email: 'a@b.co', password: '' }],
    ['invalid email', { email: 'not-an-email', password: 'x' }],
    ['missing password', { email: 'a@b.co' }],
    ['non-string password', { email: 'a@b.co', password: 123 }],
    ['null email', { email: null, password: 'x' }],
    ['unknown property', { email: 'a@b.co', password: 'x', role: 'admin' }],
  ])('rejects %s', (_name, body) => {
    expect(loginRequestSchema.safeParse(body).success).toBe(false);
  });
});
