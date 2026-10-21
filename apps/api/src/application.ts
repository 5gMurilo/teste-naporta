import { ConsoleLogger, type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createAppModule } from './app.module.js';
import {
  ProblemDetailsFilter,
  type ProblemLogger,
} from './common/errors/problem-details.filter.js';
import { validationExceptionFactory } from './common/errors/validation.exception.js';
import { requestIdMiddleware } from './common/http/request-id.middleware.js';
import type { ApiConfig } from './config/env.js';

export type ApplicationMode = 'http' | 'docs';

export function configureApplication(
  app: INestApplication,
  logger: ProblemLogger = new ConsoleLogger('ProblemDetails'),
): void {
  app.use(requestIdMiddleware);
  app.useGlobalPipes(
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
    configureApplication(app);
    if (mode === 'http') await app.init();
    return app;
  } catch {
    await app?.close().catch(() => undefined);
    throw new Error('Unable to initialize API application');
  }
}
