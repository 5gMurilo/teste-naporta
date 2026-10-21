import { expect, test } from './fixtures';
import {
  apiToken,
  createOrder,
  fillOrderForm,
  navigateInApp,
  openNewOrderForm,
  signIn,
} from './support/api';

const confirmDeletion = async (page: import('@playwright/test').Page, orderNumber: string) => {
  await page.getByRole('button', { name: `Excluir pedido ${orderNumber}` }).click();
  await expect(
    page.getByRole('alertdialog', { name: `Excluir o pedido ${orderNumber}?` }),
  ).toBeVisible();
};

test('runs the whole life of an order through the interface: create, find, open, edit, delete', async ({
  page,
  request,
  stack,
}) => {
  await signIn(page);
  await openNewOrderForm(page);
  await fillOrderForm(page, {
    orderNumber: 'NP-LIFE',
    items: [
      { description: 'Chá verde', priceCents: '1200' },
      { description: 'Biscoito', priceCents: '300' },
    ],
  });
  await page.getByRole('button', { name: 'Criar pedido' }).click();
  await expect(page.getByRole('heading', { name: 'Detalhe do pedido' })).toBeVisible();
  await expect(page.getByRole('row', { name: /Total/ })).toContainText('R$ 15,00');

  await page.getByRole('link', { name: 'Voltar para a lista' }).click();
  await page.getByLabel('Número do pedido').fill('NP-LIFE');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await page.getByRole('link', { name: 'NP-LIFE' }).click();

  await page.getByRole('link', { name: 'Editar' }).click();
  await page.getByLabel('Status').selectOption('DELIVERED');
  await page.getByRole('button', { name: 'Remover item 2' }).click();
  await page.getByRole('button', { name: 'Salvar alterações' }).click();
  await expect(page.getByText('Entregue')).toBeVisible();
  await expect(page.getByRole('row', { name: /Total/ })).toContainText('R$ 12,00');

  await confirmDeletion(page, 'NP-LIFE');
  await page.getByRole('button', { name: 'Excluir pedido', exact: true }).click();

  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByText('Nenhum pedido encontrado.')).toBeVisible();
  const token = await apiToken(request);
  const list = await request.get(`${stack.apiUrl}/api/v1/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect((await list.json()).meta.total).toBe(0);
});

test('cancelling the dialog keeps the order and sends no DELETE', async ({ page, request }) => {
  const token = await apiToken(request);
  await createOrder(request, token, { orderNumber: 'NP-KEEP' });
  let deletes = 0;
  page.on('request', (req) => {
    if (req.method() === 'DELETE') deletes += 1;
  });
  await signIn(page);

  await confirmDeletion(page, 'NP-KEEP');
  await page.getByRole('button', { name: 'Cancelar' }).click();

  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Excluir pedido NP-KEEP' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'NP-KEEP' })).toBeVisible();
  expect(deletes).toBe(0);
});

test('sends one DELETE for a double click and the deleted order answers 404 in the detail', async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const created = await createOrder(request, token, { orderNumber: 'NP-ONCE-DEL' });
  let deletes = 0;
  await page.route(`**/api/v1/orders/${created.id}`, async (route) => {
    if (route.request().method() === 'DELETE') {
      deletes += 1;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.continue();
  });
  await signIn(page);

  await confirmDeletion(page, 'NP-ONCE-DEL');
  await page.getByRole('button', { name: 'Excluir pedido', exact: true }).dblclick();

  await expect(page.getByText('Nenhum pedido encontrado.')).toBeVisible();
  expect(deletes).toBe(1);
  await navigateInApp(page, `/orders/${created.id}`);
  await expect(page.getByRole('alert')).toHaveText('Pedido não encontrado.');
});

test('keeps the dialog open with the reason when the network fails, then succeeds on retry', async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  const created = await createOrder(request, token, { orderNumber: 'NP-NET-DEL' });
  let broken = true;
  await page.route(`**/api/v1/orders/${created.id}`, (route) =>
    route.request().method() === 'DELETE' && broken ? route.abort('failed') : route.continue(),
  );
  await signIn(page);

  await confirmDeletion(page, 'NP-NET-DEL');
  await page.getByRole('button', { name: 'Excluir pedido', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Não foi possível conectar ao servidor');
  await expect(page.getByRole('alertdialog')).toBeVisible();

  broken = false;
  await page.getByRole('button', { name: 'Excluir pedido', exact: true }).click();
  await expect(page.getByText('Nenhum pedido encontrado.')).toBeVisible();
});

test('returns to the previous page when the only order of the last page is deleted', async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  for (let n = 1; n <= 21; n += 1) {
    await createOrder(request, token, { orderNumber: `NP-${String(n).padStart(2, '0')}` });
  }
  await signIn(page);
  await page.getByRole('button', { name: 'Próxima' }).click();
  await expect(page.getByText('Página 2 de 2 · 21 pedido(s)')).toBeVisible();
  // Newest first: the only order on page 2 is the oldest one.
  await expect(page.getByRole('link', { name: 'NP-01' })).toBeVisible();

  await confirmDeletion(page, 'NP-01');
  await page.getByRole('button', { name: 'Excluir pedido', exact: true }).click();

  await expect(page.getByText('Página 1 de 1 · 20 pedido(s)')).toBeVisible();
  await expect(page.getByRole('rowheader', { name: /^NP-/ })).toHaveCount(20);
  await expect(page.getByRole('heading', { name: 'Pedidos', level: 1 })).toBeFocused();
});

test('tells the user when the order was already deleted elsewhere', async ({
  page,
  request,
  stack,
}) => {
  const token = await apiToken(request);
  const created = await createOrder(request, token, { orderNumber: 'NP-GONE' });
  await signIn(page);
  await confirmDeletion(page, 'NP-GONE');
  await request.delete(`${stack.apiUrl}/api/v1/orders/${created.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await page.getByRole('button', { name: 'Excluir pedido', exact: true }).click();

  await expect(page.getByRole('alert')).toHaveText('Pedido não encontrado.');
  await expect(page.getByRole('alertdialog')).toBeVisible();
});

test('the delete dialog is operable by keyboard on a phone-sized screen', async ({
  page,
  request,
}) => {
  const token = await apiToken(request);
  await createOrder(request, token, { orderNumber: 'NP-KB' });
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);

  await page.getByRole('button', { name: 'Excluir pedido NP-KB' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Cancelar' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Excluir pedido', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');

  await expect(page.getByText('Nenhum pedido encontrado.')).toBeVisible();
});
