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
