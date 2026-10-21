import type { INestApplication } from '@nestjs/common';
import helmet from 'helmet';
import type { ApiConfig } from './config/env.js';

/**
 * Security headers and CORS for the HTTP surface.
 *
 * Helmet's default Content-Security-Policy would block the inline scripts of Swagger UI, so only
 * the documentation pages skip the CSP header; every other helmet header still applies there.
 * CORS allows exactly the configured origin (never a wildcard) and nothing when none is set.
 */
export function applyHttpSecurity(
  app: INestApplication,
  config: Pick<ApiConfig, 'CORS_ORIGIN'>,
): void {
  const apiHeaders = helmet();
  const docsHeaders = helmet({ contentSecurityPolicy: false });
  app.use((req: { url?: string }, res: never, next: () => void) => {
    const isDocs =
      req.url === '/docs' || req.url?.startsWith('/docs/') || req.url?.startsWith('/docs-json');
    (isDocs ? docsHeaders : apiHeaders)(req as never, res, next);
  });

  app.enableCors({
    // A callback (not the plain string) so a foreign Origin gets no CORS header at all.
    origin: (
      requestOrigin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => callback(null, config.CORS_ORIGIN !== undefined && requestOrigin === config.CORS_ORIGIN),
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['Location', 'X-Request-Id'],
    maxAge: 600,
  });
}
