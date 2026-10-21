import { defaultSteps } from './support/default-steps';
import { startStack } from './support/stack';

/** Starts the disposable stack once per run and returns the matching teardown. */
export default async function globalSetup() {
  const stack = await startStack(defaultSteps);
  process.env.E2E_API_URL = stack.apiUrl;
  process.env.E2E_WEB_URL = stack.webUrl;
  process.env.E2E_DATABASE_URL = stack.databaseUrl;
  process.env.E2E_REDIS_URL = stack.redisUrl;
  process.env.E2E_SEED_EMAIL = stack.seed.email;
  process.env.E2E_SEED_PASSWORD = stack.seed.password;
  return () => stack.stop();
}
