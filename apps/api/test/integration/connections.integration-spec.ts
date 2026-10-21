import { Client } from 'pg';
import { createIntegrationApp } from '../helpers/integration-app.js';

async function sessions(admin: Client): Promise<number> {
  const { rows } = await admin.query<{ count: string }>(
    'SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()',
  );
  return Number(rows[0]?.count);
}

describe('PostgreSQL connections of the application', () => {
  it('releases its PostgreSQL connections when the application closes', async () => {
    const admin = new Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
    try {
      const before = await sessions(admin);

      const env = await createIntegrationApp();
      await env.prisma.user.count();
      const during = await sessions(admin);
      await env.app.close();

      // Well under the pool idle timeout (10 s), so only an explicit disconnect can pass.
      const deadline = Date.now() + 2_000;
      let after = await sessions(admin);
      while (after > before && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        after = await sessions(admin);
      }

      expect(during).toBeGreaterThan(before);
      expect(after).toBe(before);
    } finally {
      await admin.end();
    }
  });
});
