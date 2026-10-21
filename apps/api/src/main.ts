import 'reflect-metadata';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { createApplication } from './application.js';
import { loadApiConfig } from './config/env.js';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });

async function bootstrap() {
  const config = loadApiConfig();
  const app = await createApplication(config);
  app.enableShutdownHooks();
  await app.listen(config.PORT);
}

bootstrap().catch((_error: unknown) => {
  console.error('API startup failed');
  process.exitCode = 1;
});
