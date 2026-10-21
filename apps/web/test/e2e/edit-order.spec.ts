import { expect, test } from './fixtures';
import { apiToken, createOrder, signIn } from './support/api';

const open = async (page: import('@playwright/test').Page, orderNumber: string) => {
  await page.getByRole('link', { name: orderNumber }).click();
  await page.getByRole('link', { name: 'Editar' }).click();
  await page.getByRole('heading', { name: 'Editar pedido', level: 1 }).waitFor();
  await page.getByLabel('Número do pedido').waitFor();
};

test('changes only the status: the PATCH carries no items, and the detail shows the confirmed order', async ({
  page,
  request,
  stack,
}) => {
  const token = await apiToken(request);
  const created = await createOrder(request, token, { orderNumber: 'NP-EDIT-1' });
  const bodies: Record<string, unknown>[] = [];
  page.on('request', (req) => {
    if (req.method() === 'PATCH') bodies.push(req.postDataJSON());
  });
  await signIn(page);
  await open(page, 'NP-EDIT-1');

  await page.getByLabel('Status').selectOption('SHIPPED');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.getByRole('heading', { name: 'Detalhe do pedido' })).toBeVisible();
  await expect(page.getByText('Enviado')).toBeVisible();
  expect(bodies).toEqual([{ status: 'SHIPPED' }]);
  const fresh = await request.get(`${stack.apiUrl}/api/v1/orders/${created.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect((await fresh.json()).status).toBe('SHIPPED');
});

test('replaces the item list and the cached detail never serves the old one', async ({
  page,
  request,
  stack,
}) => {
  const token = await apiToken(request);
  const created = await createOrder(request, token, { orderNumber: 'NP-EDIT-2' });
  const headers = { Authorization: `Bearer ${token}` };
  await request.get(`${stack.apiUrl}/api/v1/orders/${created.id}`, { headers });
  await signIn(page);
  await open(page, 'NP-EDIT-2');

  await page.getByLabel('Descrição do item 1').fill('Café torrado');
  await page.getByLabel('Preço do item 1 (centavos)').fill('7500');
  await page.getByRole('button', { name: 'Adicionar item' }).click();
  await page.getByLabel('Descrição do item 2').fill('Filtro');
  await page.getByLabel('Preço do item 2 (centavos)').fill('500');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.getByRole('row', { name: /Café torrado/ })).toContainText('R$ 75,00');
  await expect(page.getByRole('row', { name: /Total/ })).toContainText('R$ 80,00');
  const fresh = await (
    await request.get(`${stack.apiUrl}/api/v1/orders/${created.id}`, { headers })
  ).json();
  expect(fresh.items.map((item: { description: string }) => item.description)).toEqual([
    'Café torrado',
    'Filtro',
  ]);
  expect(fresh.totalCents).toBe(8000);
});

test('does not send a request when nothing changed', async ({ page, request }) => {
  const token = await apiToken(request);
  await createOrder(request, token, { orderNumber: 'NP-EDIT-3' });
  let patches = 0;
  page.on('request', (req) => {
    if (req.method() === 'PATCH') patches += 1;
  });
  await signIn(page);
  await open(page, 'NP-EDIT-3');

  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.getByRole('status')).toHaveText('Nenhuma alteração para salvar.');
  expect(patches).toBe(0);
});

test('shows a taken order number on its field and keeps the edit', async ({ page, request }) => {
  const token = await apiToken(request);
  await createOrder(request, token, { orderNumber: 'NP-TAKEN' });
  await createOrder(request, token, { orderNumber: 'NP-EDIT-4' });
  await signIn(page);
  await open(page, 'NP-EDIT-4');

  await page.getByLabel('Número do pedido').fill('NP-TAKEN');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.getByLabel('Número do pedido')).toHaveAccessibleDescription(
    'Já existe um pedido com este número.',
  );
  await expect(page).toHaveURL(/\/edit$/);
});

test('reports an order deleted while it was being edited instead of pretending it was saved', async ({
  page,
  request,
  stack,
}) => {
  const token = await apiToken(request);
  const created = await createOrder(request, token, { orderNumber: 'NP-EDIT-5' });
  await signIn(page);
  await open(page, 'NP-EDIT-5');
  await request.delete(`${stack.apiUrl}/api/v1/orders/${created.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await page.getByLabel('Status').selectOption('CANCELED');
  await page.getByRole('button', { name: 'Salvar alterações' }).click();

  await expect(page.getByRole('alert')).toHaveText('Pedido não encontrado.');
  await expect(page).toHaveURL(/\/edit$/);
  await expect(page.getByLabel('Status')).toHaveValue('CANCELED');
});
