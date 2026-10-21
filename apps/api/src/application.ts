import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { createAppModule } from './app.module.js';
import type { ApiConfig } from './config/env.js';

export type ApplicationMode = 'http' | 'docs';

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
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    if (mode === 'http') await app.init();
    return app;
  } catch {
    await app?.close().catch(() => undefined);
    throw new Error('Unable to initialize API application');
  }
}
