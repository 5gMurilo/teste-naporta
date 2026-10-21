import type { JwtModuleOptions } from '@nestjs/jwt';
import type { ApiConfig } from '../config/env.js';

/**
 * The single place that decides how tokens are signed and verified. Verification pins the
 * algorithm, issuer, and audience, so a token signed with the right secret but another algorithm
 * or issuer is still rejected.
 */
export function jwtModuleOptions(
  config: Pick<ApiConfig, 'JWT_SECRET' | 'JWT_EXPIRES_IN' | 'JWT_ISSUER' | 'JWT_AUDIENCE'>,
): JwtModuleOptions {
  return {
    secret: config.JWT_SECRET,
    signOptions: {
      algorithm: 'HS256',
      expiresIn: config.JWT_EXPIRES_IN,
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    },
    verifyOptions: {
      algorithms: ['HS256'],
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    },
  };
}
