import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Public } from '../common/decorators/public.decorator.js';
import { loadApiConfig } from '../config/env.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { AuthenticatedRequest } from './principal.js';

const config = loadApiConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://localhost/db',
  JWT_SECRET: 'k'.repeat(32),
  JWT_ISSUER: 'naporta',
  JWT_AUDIENCE: 'naporta-web',
  JWT_EXPIRES_IN: '3600',
  REDIS_URL: 'redis://127.0.0.1:1',
});

// Same verification options as AuthModule, so the guard is tested with the production setup.
const verifyingJwt = new JwtService({
  secret: config.JWT_SECRET,
  verifyOptions: {
    algorithms: ['HS256'],
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  },
});
const now = () => Math.floor(Date.now() / 1000);
const claims = { sub: 'user-1', email: 'demo@example.test' };

function sign(
  overrides: Record<string, unknown> = {},
  options: { secret?: string; algorithm?: 'HS256' | 'HS384' } = {},
) {
  return new JwtService({ secret: options.secret ?? config.JWT_SECRET }).sign(
    { iss: 'naporta', aud: 'naporta-web', exp: now() + 60, ...claims, ...overrides },
    { algorithm: options.algorithm ?? 'HS256' },
  );
}

class PrivateController {
  handler() {}
}

@Public()
class PublicController {
  handler() {}
}

function context(
  controller: { prototype: { handler(): void } } & (new () => unknown),
  authorization?: string,
) {
  const request: AuthenticatedRequest = { headers: { authorization } } as AuthenticatedRequest;
  const ctx = {
    getHandler: () => controller.prototype.handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { ctx, request };
}

const guard = new JwtAuthGuard(new Reflector(), verifyingJwt);

describe('JwtAuthGuard', () => {
  it('accepts a valid bearer token and attaches only the minimal principal', async () => {
    const { ctx, request } = context(PrivateController, `Bearer ${sign({ extra: 'dropped' })}`);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.principal).toEqual({ sub: 'user-1', email: 'demo@example.test' });
  });

  it('lets @Public handlers through without a token and does not touch the principal', async () => {
    const { ctx, request } = context(PublicController);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.principal).toBeUndefined();
  });

  it.each([
    ['no authorization header', undefined],
    ['empty header', ''],
    ['wrong scheme', 'Basic abc'],
    ['bearer without token', 'Bearer '],
    ['extra segments', 'Bearer a b'],
    ['garbage token', 'Bearer not-a-jwt'],
    ['bad signature', `Bearer ${sign({}, { secret: 'x'.repeat(32) })}`],
    ['expired token', `Bearer ${sign({ exp: now() - 10 })}`],
    ['wrong issuer', `Bearer ${sign({ iss: 'someone-else' })}`],
    ['wrong audience', `Bearer ${sign({ aud: 'other-audience' })}`],
    ['missing issuer', `Bearer ${sign({ iss: undefined })}`],
    ['other HMAC algorithm', `Bearer ${sign({}, { algorithm: 'HS384' })}`],
    [
      'unsigned alg none token',
      `Bearer ${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...claims, iss: 'naporta', aud: 'naporta-web', exp: now() + 60 })).toString('base64url')}.`,
    ],
    ['missing sub claim', `Bearer ${sign({ sub: undefined })}`],
    ['missing email claim', `Bearer ${sign({ email: undefined })}`],
  ])('rejects %s with 401', async (_name, authorization) => {
    const { ctx, request } = context(PrivateController, authorization);

    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(request.principal).toBeUndefined();
  });

  it('accepts a lowercase bearer scheme', async () => {
    const { ctx } = context(PrivateController, `bearer ${sign()}`);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });
});
