import 'reflect-metadata';
import dotenv from 'dotenv';
import { createApplication } from './application.js';
import { ConfigError, loadApiConfig } from './config/env.js';
import { repositoryEnvPath } from './env-file.js';

dotenv.config({ path: repositoryEnvPath(import.meta.dirname), quiet: true });

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
