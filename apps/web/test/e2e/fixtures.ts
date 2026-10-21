import { test as base, expect } from '@playwright/test';
import { resetData, stackEnv } from './support/data';

export const test = base.extend<{ stack: ReturnType<typeof stackEnv> }>({
  // Resolved at test time: the ports only exist after global setup started the stack.
  baseURL: async ({ browser: _browser }, use) => {
    await use(stackEnv().webUrl);
  },
  stack: [
    async ({ browser: _browser }, use) => {
      await resetData();
      await use(stackEnv());
    },
    { auto: true },
  ],
});

export { expect };
