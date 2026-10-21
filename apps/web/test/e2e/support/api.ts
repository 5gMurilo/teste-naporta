import type { APIRequestContext, Page } from '@playwright/test';
import { stackEnv } from './data';

export interface OrderBody {
  orderNumber: string;
  status?: string;
  expectedDeliveryDate?: string;
  customer?: { name: string; document: string };
  items?: { description: string; priceCents: number }[];
}

export async function apiToken(request: APIRequestContext): Promise<string> {
  const { apiUrl, seed } = stackEnv();
  const response = await request.post(`${apiUrl}/api/v1/auth/login`, { data: seed });
  return (await response.json()).accessToken as string;
}

/** Creates an order straight through the real API, the way an integration client would. */
export async function createOrder(request: APIRequestContext, token: string, body: OrderBody) {
  const { apiUrl } = stackEnv();
  const response = await request.post(`${apiUrl}/api/v1/orders`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      expectedDeliveryDate: '2026-11-03',
      customer: { name: 'Ana Silva', document: 'DOC-1' },
      deliveryAddress: {
        street: 'Rua das Flores',
        number: '101',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        postalCode: '01001000',
      },
      items: [{ description: 'Café', priceCents: 4990 }],
      ...body,
    },
  });
  if (response.status() !== 201)
    throw new Error(`Could not create ${body.orderNumber}: ${response.status()}`);
  return (await response.json()) as { id: string; orderNumber: string };
}

export async function signIn(page: Page) {
  const { seed } = stackEnv();
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(seed.email);
  await page.getByLabel('Senha').fill(seed.password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('heading', { name: 'Pedidos' }).waitFor();
}

/**
 * Client-side navigation. The session lives in memory only, so `page.goto` (a full reload) would
 * log the user out; this keeps the SPA, and therefore the session, alive.
 */
export async function navigateInApp(page: Page, path: string) {
  await page.evaluate((target) => {
    window.history.pushState({}, '', target);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

export interface OrderFormInput {
  orderNumber: string;
  postalCode?: string;
  items?: { description: string; priceCents: string }[];
}

/** Fills the order form the way a person would, by label. */
export async function fillOrderForm(page: Page, input: OrderFormInput) {
  await page.getByLabel('Número do pedido').fill(input.orderNumber);
  await page.getByLabel('Previsão de entrega').fill('2026-11-03');
  await page.getByLabel('Nome do cliente').fill('Bia Souza');
  await page.getByLabel('Documento do cliente').fill('DOC-123');
  await page.getByLabel('Rua').fill('Rua das Palmeiras');
  await page.getByLabel('Número', { exact: true }).fill('42');
  await page.getByLabel('Bairro').fill('Centro');
  await page.getByLabel('Cidade').fill('Santos');
  await page.getByLabel('UF').fill('sp');
  await page.getByLabel('CEP').fill(input.postalCode ?? '11010000');
  const items = input.items ?? [{ description: 'Chá verde', priceCents: '1200' }];
  for (const [index, item] of items.entries()) {
    if (index > 0) await page.getByRole('button', { name: 'Adicionar item' }).click();
    await page.getByLabel(`Descrição do item ${index + 1}`).fill(item.description);
    await page.getByLabel(`Preço do item ${index + 1} (centavos)`).fill(item.priceCents);
  }
}

/** Opens the creation form from the list and waits for it, so no field is filled on the wrong page. */
export async function openNewOrderForm(page: Page) {
  await page.getByRole('link', { name: 'Novo pedido' }).click();
  await page.getByRole('heading', { name: 'Novo pedido', level: 1 }).waitFor();
}
