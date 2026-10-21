import {
  type INestApplication,
  StandardSchemaValidationPipe,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createAppModule } from './app.module.js';
import {
  ProblemDetailsFilter,
  type ProblemLogger,
} from './common/errors/problem-details.filter.js';
import {
  schemaExceptionFactory,
  validationExceptionFactory,
} from './common/errors/validation.exception.js';
import { requestIdMiddleware } from './common/http/request-id.middleware.js';
import type { ApiConfig } from './config/env.js';
import { setupDocs } from './docs/openapi.js';
import { applyHttpSecurity } from './http-security.js';

/** One JSON object per line on stderr: no colours, no prefix, parseable by any log collector. */
const jsonErrorLogger: ProblemLogger = { error: (message) => process.stderr.write(`${message}\n`) };

export type ApplicationMode = 'http' | 'docs';

export function configureApplication(
  app: INestApplication,
  logger: ProblemLogger = jsonErrorLogger,
): void {
  app.use(requestIdMiddleware);
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({ exceptionFactory: schemaExceptionFactory }),
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter(logger));
}

export async function createApplication(
  config: ApiConfig,
  mode: ApplicationMode = 'http',
): Promise<INestApplication> {
  let app: INestApplication | undefined;
  try {
    app = await NestFactory.create(createAppModule(config), {
      abortOnError: false,
      logger: false,
    });
    applyHttpSecurity(app, config);
    configureApplication(app);
    if (mode === 'http') setupDocs(app);
    if (mode === 'http') await app.init();
    return app;
  } catch {
    await app?.close().catch(() => undefined);
    throw new Error('Unable to initialize API application');
  }
}
