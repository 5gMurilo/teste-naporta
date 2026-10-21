import { expect, test } from './fixtures';
import { apiToken, createOrder, fillOrderForm, openNewOrderForm, signIn } from './support/api';

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test.describe(`create order at ${viewport.width}px`, () => {
    test.use({ viewport });

    test('creates an order with two items through the form and lands on its detail', async ({
      page,
      request,
      stack,
    }) => {
      await signIn(page);
      await page.getByRole('link', { name: 'Novo pedido' }).click();
      await expect(page.getByRole('heading', { name: 'Novo pedido', level: 1 })).toBeVisible();

      await fillOrderForm(page, {
        orderNumber: `NP-UI-${viewport.width}`,
        items: [
          { description: 'Chá verde', priceCents: '1200' },
          { description: 'Biscoito', priceCents: '0' },
        ],
      });
      await page.getByRole('button', { name: 'Criar pedido' }).click();

      await expect(page.getByRole('heading', { name: 'Detalhe do pedido' })).toBeVisible();
      await expect(page.getByText(`NP-UI-${viewport.width}`)).toBeVisible();
      await expect(page.getByRole('row', { name: /Total/ })).toContainText('R$ 12,00');
      const token = await apiToken(request);
      const list = await request.get(`${stack.apiUrl}/api/v1/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect((await list.json()).data.map((o: { orderNumber: string }) => o.orderNumber)).toEqual([
        `NP-UI-${viewport.width}`,
      ]);
    });
  });
}

test('shows a duplicated order number on its field and keeps what was typed', async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  await createOrder(request, token, { orderNumber: 'NP-DUP' });
  await signIn(page);
  await openNewOrderForm(page);

  await fillOrderForm(page, { orderNumber: 'NP-DUP' });
  await page.getByRole('button', { name: 'Criar pedido' }).click();

  const number = page.getByLabel('Número do pedido');
  await expect(number).toHaveAccessibleDescription('Já existe um pedido com este número.');
  await expect(number).toBeFocused();
  await expect(page).toHaveURL(/\/orders\/new$/);
  await expect(page.getByLabel('Nome do cliente')).toHaveValue('Bia Souza');
  await expect(page.getByLabel('Preço do item 1 (centavos)')).toHaveValue('1200');
});

test('puts the API validation error on the postal code field', async ({ page }) => {
  await signIn(page);
  await openNewOrderForm(page);

  await fillOrderForm(page, { orderNumber: 'NP-CEP', postalCode: '123' });
  await page.getByRole('button', { name: 'Criar pedido' }).click();

  await expect(page.getByLabel('CEP')).toHaveAccessibleDescription(
    'Valor inválido. Confira o campo.',
  );
  await expect(page.getByLabel('CEP')).toBeFocused();
  await expect(page.getByRole('alert')).toHaveText('Verifique os campos destacados.');
});

test('does not repeat a POST after a network failure and succeeds when the user retries', async ({
  page,
}) => {
  let posts = 0;
  let broken = true;
  await page.route('**/api/v1/orders', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    posts += 1;
    if (broken) return route.abort('failed');
    return route.continue();
  });
  await signIn(page);
  await openNewOrderForm(page);
  await fillOrderForm(page, { orderNumber: 'NP-NET' });

  await page.getByRole('button', { name: 'Criar pedido' }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar ao servidor');
  await page.waitForTimeout(400);
  expect(posts).toBe(1);
  await expect(page.getByLabel('Número do pedido')).toHaveValue('NP-NET');

  broken = false;
  await page.getByRole('button', { name: 'Criar pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Detalhe do pedido' })).toBeVisible();
  expect(posts).toBe(2);
});

test('creates the order only once when the button is clicked twice', async ({
  page,
  request,
  stack,
}) => {
  let posts = 0;
  await page.route('**/api/v1/orders', async (route) => {
    if (route.request().method() === 'POST') {
      posts += 1;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.continue();
  });
  await signIn(page);
  await openNewOrderForm(page);
  await fillOrderForm(page, { orderNumber: 'NP-ONCE' });

  await page.getByRole('button', { name: 'Criar pedido' }).dblclick();

  await expect(page.getByRole('heading', { name: 'Detalhe do pedido' })).toBeVisible();
  expect(posts).toBe(1);
  const token = await apiToken(request);
  const list = await request.get(`${stack.apiUrl}/api/v1/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect((await list.json()).meta.total).toBe(1);
});
