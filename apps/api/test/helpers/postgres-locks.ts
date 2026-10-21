import { Client } from 'pg';
import type { PrismaService } from '../../src/prisma/prisma.service.js';

/**
 * Waits until some backend is blocked on a row lock. Deterministic barrier for concurrency tests:
 * polls the server instead of sleeping for an arbitrary time.
 */
export async function waitForBlockedWriter(prisma: PrismaService, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const [row] = await prisma.$queryRaw<{ blocked: bigint }[]>`
      SELECT count(*) AS blocked FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()`;
    if (row && row.blocked > 0n) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('No writer became blocked on a row lock');
}

/** Runs a read on a brand new connection, proving the committed state rather than a pooled view. */
export async function queryFresh<T extends object>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}
