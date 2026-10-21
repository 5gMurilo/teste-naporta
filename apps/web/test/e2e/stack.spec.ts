import { expect, test } from './fixtures';
import { withDatabase, withRedis } from './support/data';

test.describe('disposable stack', () => {
  test('serves the SPA shell and every asset it references', async ({ page }) => {
    const failed: string[] = [];
    const assets: string[] = [];
    page.on('response', (response) => {
      if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`);
      if (/\.(js|css)$/.test(new URL(response.url()).pathname)) assets.push(response.url());
    });

    await page.goto('/');

    await expect(page).toHaveTitle('naPorta - Pedidos');
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
    expect(page).toHaveURL(/\/login$/);
    expect(assets.length).toBeGreaterThanOrEqual(2);
    expect(failed).toEqual([]);
  });

  test('reaches the real API directly and through the web proxy', async ({ request, stack }) => {
    for (const base of [stack.apiUrl, stack.webUrl]) {
      const response = await request.get(`${base}/api/v1/health`);

      expect(response.status()).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok', database: 'up' });
    }
  });

  test('logs the seeded user in over HTTP through the proxy', async ({ request, stack }) => {
    const ok = await request.post(`${stack.webUrl}/api/v1/auth/login`, { data: stack.seed });
    const wrong = await request.post(`${stack.webUrl}/api/v1/auth/login`, {
      data: { email: stack.seed.email, password: 'wrong-password' },
    });

    expect(ok.status()).toBe(200);
    expect(await ok.json()).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600 });
    expect(wrong.status()).toBe(401);
    expect((await wrong.json()).code).toBe('INVALID_CREDENTIALS');
  });

  test('has the disposable PostgreSQL and Redis reachable with the seeded user', async () => {
    const users = await withDatabase((client) =>
      client.query('SELECT count(*)::int AS n FROM "User"'),
    );
    const pong = await withRedis((redis) => redis.ping());

    expect(users.rows[0].n).toBe(1);
    expect(pong).toBe('PONG');
  });

  test('gives each browser context its own storage', async ({ browser, baseURL }) => {
    const first = await browser.newContext({ baseURL });
    const second = await browser.newContext({ baseURL });
    const a = await first.newPage();
    const b = await second.newPage();
    await a.goto('/');
    await b.goto('/');

    await a.evaluate(() => localStorage.setItem('marker', 'only-in-a'));

    expect(await a.evaluate(() => localStorage.getItem('marker'))).toBe('only-in-a');
    expect(await b.evaluate(() => localStorage.getItem('marker'))).toBeNull();
    await first.close();
    await second.close();
  });

  test('starts every test without orders or cache entries left by the previous one', async ({
    request,
    stack,
  }) => {
    const login = await request.post(`${stack.apiUrl}/api/v1/auth/login`, { data: stack.seed });
    const { accessToken } = await login.json();
    await withDatabase(async (client) => {
      await client.query(
        `INSERT INTO "Order" (id, "orderNumber", "expectedDeliveryDate", "customerName", "customerDocument", "deliveryAddress", "updatedAt")
         VALUES (gen_random_uuid(), 'LEFTOVER', '2026-11-03', 'c', 'd', '{}', now())`,
      );
    });
    await withRedis((redis) => redis.set('naporta:v1:orders:leftover:detail', 'x'));
    const before = await request.get(`${stack.apiUrl}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect((await before.json()).meta.total).toBe(1);

    const { resetData } = await import('./support/data');
    await resetData();

    const after = await request.get(`${stack.apiUrl}/api/v1/orders`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect((await after.json()).meta.total).toBe(0);
    expect(await withRedis((redis) => redis.keys('naporta:*'))).toEqual([]);
  });
});
