import { expect, test } from './fixtures';
import { apiToken, createOrder, navigateInApp, signIn } from './support/api';

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
];

for (const viewport of VIEWPORTS) {
  test.describe(`order detail at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('opens from the list and shows the public fields, the BRL total and the civil date', async ({
      page,
      request,
    }) => {
      const token = await apiToken(request);
      await createOrder(request, token, {
        orderNumber: 'NP-DETAIL',
        status: 'PROCESSING',
        items: [
          { description: 'Café especial', priceCents: 4990 },
          { description: 'Caneca', priceCents: 0 },
        ],
      });
      await signIn(page);

      await page.getByRole('link', { name: 'NP-DETAIL' }).click();

      await expect(page.getByRole('heading', { name: 'Detalhe do pedido' })).toBeVisible();
      await expect(page.getByText('NP-DETAIL')).toBeVisible();
      await expect(page.getByText('Em processamento')).toBeVisible();
      await expect(page.getByText('03/11/2026')).toBeVisible();
      await expect(page.getByText('Rua das Flores, 101')).toBeVisible();
      await expect(page.getByRole('row', { name: /Café especial/ })).toContainText('R$ 49,90');
      await expect(page.getByRole('row', { name: /Total/ })).toContainText('R$ 49,90');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      expect(await page.content()).not.toMatch(/cacheRevision|deletedAt/);
    });
  });
}

test('goes to the requested order after logging in from a deep link', async ({
  page,
  request,
  stack,
}) => {
  const token = await apiToken(request);
  const created = await createOrder(request, token, { orderNumber: 'NP-DEEP' });

  await page.goto(`/orders/${created.id}`);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('E-mail').fill(stack.seed.email);
  await page.getByLabel('Senha').fill(stack.seed.password);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(new RegExp(`/orders/${created.id}$`));
  await expect(page.getByText('NP-DEEP')).toBeVisible();
});

test('explains an unknown order and offers the way back', async ({ page }) => {
  await signIn(page);

  await navigateInApp(page, '/orders/00000000-0000-4000-8000-000000000000');

  await expect(page.getByRole('alert')).toHaveText('Pedido não encontrado.');
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Voltar para a lista' }).click();
  await expect(page).toHaveURL(/\/orders$/);
});

test('shows the largest possible total without losing a cent', async ({ page, request }) => {
  const token = await apiToken(request);
  const created = await createOrder(request, token, {
    orderNumber: 'NP-MAX',
    items: Array.from({ length: 50 }, (_, index) => ({
      description: `Item ${index + 1}`,
      priceCents: 2_000_000_000,
    })),
  });
  await signIn(page);

  await navigateInApp(page, `/orders/${created.id}`);

  await expect(page.getByRole('row', { name: /Total/ })).toContainText('R$ 1.000.000.000,00');
  await expect(page.getByRole('row', { name: /Item 50/ })).toContainText('R$ 20.000.000,00');
});
