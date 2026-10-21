import { jest } from '@jest/globals';
import {
  createPostgresTestContext,
  type PostgresTestContext,
} from '../helpers/postgres-test-context.js';

jest.setTimeout(180_000);

let context: PostgresTestContext;

beforeAll(async () => {
  context = await createPostgresTestContext();
});

afterEach(async () => {
  await context?.reset();
});

afterAll(async () => {
  await context?.close();
});
