import 'reflect-metadata';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { createApplication } from './application.js';
import { ConfigError, loadApiConfig } from './config/env.js';

dotenv.config({ path: resolve(import.meta.dirname, '../../.env'), quiet: true });

async function bootstrap() {
  const config = loadApiConfig();
  const app = await createApplication(config);
  app.enableShutdownHooks();
  await app.listen(config.PORT);
}

bootstrap().catch((error: unknown) => {
  // A configuration error only lists variable names; anything else stays generic.
  console.error(
    error instanceof ConfigError ? `API startup failed: ${error.message}` : 'API startup failed',
  );
  process.exitCode = 1;
});
