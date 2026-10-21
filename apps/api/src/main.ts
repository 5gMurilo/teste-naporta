import 'reflect-metadata';
import { resolve } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import dotenv from 'dotenv';
import { AppModule } from './app.module.js';
import { API_CONFIG, type ApiConfig } from './config/env.js';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get<ApiConfig>(API_CONFIG);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();
  await app.listen(config.PORT);
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error';
  console.error(`API startup failed: ${message}`);
  process.exitCode = 1;
});
