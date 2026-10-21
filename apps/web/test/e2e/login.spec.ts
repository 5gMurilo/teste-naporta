import { expect, test } from './fixtures';

const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`login at ${viewport.width}px (${viewport.name})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('signs in with the seeded user, shows the orders area, signs out, and a reload needs a new login', async ({
      page,
      stack,
      context,
    }) => {
      await page.goto('/orders');
      await expect(page).toHaveURL(/\/login$/);

      await page.getByLabel('E-mail').fill(stack.seed.email);
      await page.getByLabel('Senha').fill(stack.seed.password);
      await page.getByRole('button', { name: 'Entrar' }).click();

      await expect(page).toHaveURL(/\/orders$/);
      await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
      await expect(page.getByText(stack.seed.email)).toBeVisible();
      expect(page.url()).not.toContain('token');
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
      expect(await context.cookies()).toEqual([]);

      await page.reload();
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();

      await page.getByLabel('E-mail').fill(stack.seed.email);
      await page.getByLabel('Senha').fill(stack.seed.password);
      await page.getByRole('button', { name: 'Entrar' }).click();
      await page.getByRole('button', { name: 'Sair' }).click();
      await expect(page).toHaveURL(/\/login$/);
      await page.goto('/orders');
      await expect(page).toHaveURL(/\/login$/);
    });

    test('rejects a wrong password with a calm message and stays on the form', async ({
      page,
      stack,
    }) => {
      await page.goto('/login');
      await page.getByLabel('E-mail').fill(stack.seed.email);
      await page.getByLabel('Senha').fill('senha-incorreta');
      await page.getByRole('button', { name: 'Entrar' }).click();

      await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.');
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByLabel('E-mail')).toHaveValue(stack.seed.email);
      await expect(page.getByLabel('Senha')).toBeFocused();
      expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
    });

    test('is fully operable by keyboard with visible labels and no horizontal scroll', async ({
      page,
      stack,
    }) => {
      await page.goto('/login');

      await page.keyboard.press('Tab');
      await expect(page.getByLabel('E-mail')).toBeFocused();
      await page.keyboard.type(stack.seed.email);
      await page.keyboard.press('Tab');
      await expect(page.getByLabel('Senha')).toBeFocused();
      await page.keyboard.type(stack.seed.password);
      await page.keyboard.press('Enter');

      await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test('sends one login request even when the button is clicked repeatedly', async ({
  page,
  stack,
}) => {
  const logins: string[] = [];
  page.on('request', (request) => {
    if (request.url().endsWith('/api/v1/auth/login')) logins.push(request.method());
  });
  await page.route('**/api/v1/auth/login', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(stack.seed.email);
  await page.getByLabel('Senha').fill(stack.seed.password);

  const button = page.getByRole('button', { name: 'Entrar' });
  await button.dblclick();
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
  expect(logins).toEqual(['POST']);
});
