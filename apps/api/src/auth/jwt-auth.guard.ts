import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator.js';
import type { AuthenticatedRequest, Principal } from './principal.js';

function bearerToken(header: string | undefined): string | undefined {
  const parts = header?.split(' ');
  if (parts?.length !== 2 || parts[0]?.toLowerCase() !== 'bearer' || !parts[1]) return undefined;
  return parts[1];
}

function toPrincipal(payload: unknown): Principal | undefined {
  const { sub, email } = (payload ?? {}) as Record<string, unknown>;
  return typeof sub === 'string' && sub && typeof email === 'string' && email
    ? { sub, email }
    : undefined;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = bearerToken(request.headers.authorization);
    if (!token) throw new UnauthorizedException();

    // Algorithm, issuer, audience, and expiry are enforced by the JwtModule verifyOptions.
    const principal = await this.jwt
      .verifyAsync(token)
      .then(toPrincipal)
      .catch(() => undefined);
    if (!principal) throw new UnauthorizedException();

    request.principal = principal;
    return true;
  }
}
