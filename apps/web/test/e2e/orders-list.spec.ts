import { expect, test } from './fixtures';
import { apiToken, createOrder, signIn } from './support/api';

test.describe('orders list in the browser', () => {
  test('shows the empty state for a fresh database', async ({ page }) => {
    await signIn(page);

    await expect(page.getByText('Nenhum pedido encontrado.')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('lists real orders and filters them by status, number, and period', async ({
    page,
    request,
  }) => {
    const token = await apiToken(request);
    await createOrder(request, token, { orderNumber: 'NP-A', status: 'SHIPPED' });
    await createOrder(request, token, { orderNumber: 'NP-B', status: 'CANCELED' });
    await createOrder(request, token, { orderNumber: 'NP-C' });
    await signIn(page);

    const rows = page.getByRole('row');
    await expect(page.getByRole('rowheader', { name: /^NP-/ })).toHaveCount(3);
    await expect(page.getByText('Página 1 de 1 · 3 pedido(s)')).toBeVisible();
    await expect(page.getByRole('cell', { name: '03/11/2026' }).first()).toBeVisible();

    await page.getByLabel('Status').selectOption('SHIPPED');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByRole('rowheader', { name: 'NP-A' })).toBeVisible();
    await expect(page.getByRole('rowheader', { name: /^NP-/ })).toHaveCount(1);

    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    await page.getByLabel('Número do pedido').fill('NP-C');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByRole('rowheader', { name: /^NP-/ })).toHaveCount(1);
    await expect(page.getByRole('rowheader', { name: 'NP-C' })).toBeVisible();

    await page.getByRole('button', { name: 'Limpar filtros' }).click();
    const today = new Date().toISOString().slice(0, 10);
    await page.getByLabel('Criado a partir de').fill(today);
    await page.getByLabel('Criado até').fill(today);
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByRole('rowheader', { name: /^NP-/ })).toHaveCount(3);
    expect(await rows.count()).toBe(4);
  });

  test('paginates 21 orders across two pages and goes back to page 1 when a filter is applied', async ({
    page,
    request,
  }) => {
    const token = await apiToken(request);
    for (let n = 1; n <= 21; n += 1) {
      await createOrder(request, token, { orderNumber: `NP-${String(n).padStart(2, '0')}` });
    }
    await signIn(page);

    await expect(page.getByRole('rowheader', { name: /^NP-/ })).toHaveCount(20);
    await expect(page.getByText('Página 1 de 2 · 21 pedido(s)')).toBeVisible();
    await page.getByRole('button', { name: 'Próxima' }).click();
    await expect(page.getByText('Página 2 de 2 · 21 pedido(s)')).toBeVisible();
    await expect(page.getByRole('rowheader', { name: /^NP-/ })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Próxima' })).toBeDisabled();

    await page.getByLabel('Número do pedido').fill('NP-05');
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();
    await expect(page.getByText('Página 1 de 1 · 1 pedido(s)')).toBeVisible();
  });

  test('recovers from an API failure with the retry button', async ({ page, request }) => {
    const token = await apiToken(request);
    await createOrder(request, token, { orderNumber: 'NP-RETRY' });
    let failures = 1;
    await page.route('**/api/v1/orders?*', async (route) => {
      if (failures > 0) {
        failures -= 1;
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'about:blank',
            title: 'Service Unavailable',
            status: 503,
            detail: 'The service is temporarily unavailable.',
            instance: '/api/v1/orders',
            code: 'SERVICE_UNAVAILABLE',
            requestId: '5f0d1b0e-3f0e-4a56-8b57-3d9d6f9c2a10',
          }),
        });
      } else {
        await route.continue();
      }
    });

    await signIn(page);
    await expect(page.getByRole('alert')).toContainText('temporariamente indisponível');
    await page.getByRole('button', { name: 'Tentar novamente' }).click();

    await expect(page.getByRole('rowheader', { name: 'NP-RETRY' })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('sends an expired session back to the login with a distinct notice', async ({ page }) => {
    await signIn(page);
    await page.route('**/api/v1/orders?*', (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Unauthorized',
          status: 401,
          detail: 'Authentication is required or the token is invalid.',
          instance: '/api/v1/orders',
          code: 'UNAUTHORIZED',
          requestId: '5f0d1b0e-3f0e-4a56-8b57-3d9d6f9c2a10',
        }),
      }),
    );

    await page.getByRole('button', { name: 'Aplicar filtros' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('status')).toHaveText('Sua sessão expirou. Entre novamente.');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
});
