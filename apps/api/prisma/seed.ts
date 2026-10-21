import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { loadSeedConfig, type SeedConfig } from '../src/config/env.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { OrderStatus } from '../src/generated/prisma/enums.js';

export const demoOrderFixtures = [
  {
    orderNumber: 'SEED-NP-0001',
    status: OrderStatus.PENDING,
    expectedDeliveryDate: '2026-11-01',
    createdAt: '2026-10-01T12:00:00.000Z',
    customerName: 'Ana Silva',
    customerDocument: 'DEMO-0001',
    deliveryAddress: {
      street: 'Rua das Flores',
      number: '101',
      neighborhood: 'Centro',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01001000',
    },
    items: [
      { description: 'Café especial', priceCents: 4990 },
      { description: 'Caneca', priceCents: 0 },
    ],
  },
  {
    orderNumber: 'SEED-NP-0002',
    status: OrderStatus.PROCESSING,
    expectedDeliveryDate: '2026-11-02',
    createdAt: '2026-10-01T14:00:00.000Z',
    customerName: 'Bruno Costa',
    customerDocument: 'DEMO-0002',
    deliveryAddress: {
      street: 'Avenida Brasil',
      number: '202',
      neighborhood: 'Jardins',
      city: 'São Paulo',
      state: 'SP',
      postalCode: '01430000',
    },
    items: [{ description: 'Caderno', priceCents: 2590 }],
  },
  {
    orderNumber: 'SEED-NP-0003',
    status: OrderStatus.SHIPPED,
    expectedDeliveryDate: '2026-11-03',
    createdAt: '2026-10-02T09:30:00.000Z',
    customerName: 'Carla Souza',
    customerDocument: 'DEMO-0003',
    deliveryAddress: {
      street: 'Rua do Comércio',
      number: '303',
      neighborhood: 'Comercial',
      city: 'Campinas',
      state: 'SP',
      postalCode: '13010000',
    },
    items: [
      { description: 'Luminária', priceCents: 12990 },
      { description: 'Lâmpada', priceCents: 1590 },
      { description: 'Extensão', priceCents: 2290 },
    ],
  },
  {
    orderNumber: 'SEED-NP-0004',
    status: OrderStatus.DELIVERED,
    expectedDeliveryDate: '2026-11-04',
    createdAt: '2026-10-02T13:15:00.000Z',
    customerName: 'Diego Lima',
    customerDocument: 'DEMO-0004',
    deliveryAddress: {
      street: 'Rua das Palmeiras',
      number: '404',
      neighborhood: 'Vila Nova',
      city: 'Curitiba',
      state: 'PR',
      postalCode: '80010000',
    },
    items: [{ description: 'Mochila', priceCents: 18990 }],
  },
  {
    orderNumber: 'SEED-NP-0005',
    status: OrderStatus.CANCELED,
    expectedDeliveryDate: '2026-11-05',
    createdAt: '2026-10-03T08:45:00.000Z',
    customerName: 'Elisa Martins',
    customerDocument: 'DEMO-0005',
    deliveryAddress: {
      street: 'Rua do Sol',
      number: '505',
      neighborhood: 'Boa Vista',
      city: 'Recife',
      state: 'PE',
      postalCode: '50010000',
    },
    items: [
      { description: 'Garrafa térmica', priceCents: 7990 },
      { description: 'Bolsa térmica', priceCents: 10990 },
    ],
  },
  {
    orderNumber: 'SEED-NP-0006',
    status: OrderStatus.PENDING,
    expectedDeliveryDate: '2026-11-06',
    createdAt: '2026-10-03T10:20:00.000Z',
    customerName: 'Felipe Rocha',
    customerDocument: 'DEMO-0006',
    deliveryAddress: {
      street: 'Avenida Central',
      number: '606',
      neighborhood: 'Centro',
      city: 'Belo Horizonte',
      state: 'MG',
      postalCode: '30110000',
    },
    items: [{ description: 'Fone de ouvido', priceCents: 8990 }],
  },
  {
    orderNumber: 'SEED-NP-0007',
    status: OrderStatus.PROCESSING,
    expectedDeliveryDate: '2026-11-07',
    createdAt: '2026-10-04T11:00:00.000Z',
    customerName: 'Gabi Almeida',
    customerDocument: 'DEMO-0007',
    deliveryAddress: {
      street: 'Rua das Acácias',
      number: '707',
      neighborhood: 'Jardim Sul',
      city: 'Goiânia',
      state: 'GO',
      postalCode: '74000000',
    },
    items: [
      { description: 'Organizador', priceCents: 3490 },
      { description: 'Caixa plástica', priceCents: 4990 },
    ],
  },
  {
    orderNumber: 'SEED-NP-0008',
    status: OrderStatus.SHIPPED,
    expectedDeliveryDate: '2026-11-08',
    createdAt: '2026-10-04T16:40:00.000Z',
    customerName: 'Heitor Nunes',
    customerDocument: 'DEMO-0008',
    deliveryAddress: {
      street: 'Rua da Praia',
      number: '808',
      neighborhood: 'Praia Grande',
      city: 'Santos',
      state: 'SP',
      postalCode: '11010000',
    },
    items: [{ description: 'Toalha', priceCents: 4590 }],
  },
  {
    orderNumber: 'SEED-NP-0009',
    status: OrderStatus.DELIVERED,
    expectedDeliveryDate: '2026-11-09',
    createdAt: '2026-10-05T07:10:00.000Z',
    customerName: 'Iara Ferreira',
    customerDocument: 'DEMO-0009',
    deliveryAddress: {
      street: 'Rua das Oliveiras',
      number: '909',
      neighborhood: 'Centro',
      city: 'Porto Alegre',
      state: 'RS',
      postalCode: '90010000',
    },
    items: [
      { description: 'Vaso', priceCents: 6490 },
      { description: 'Terra vegetal', priceCents: 1290 },
      { description: 'Sementes', priceCents: 890 },
    ],
  },
  {
    orderNumber: 'SEED-NP-0010',
    status: OrderStatus.CANCELED,
    expectedDeliveryDate: '2026-11-10',
    createdAt: '2026-10-05T15:25:00.000Z',
    customerName: 'João Pereira',
    customerDocument: 'DEMO-0010',
    deliveryAddress: {
      street: 'Avenida Atlântica',
      number: '1001',
      neighborhood: 'Copacabana',
      city: 'Rio de Janeiro',
      state: 'RJ',
      postalCode: '22010000',
    },
    items: [{ description: 'Livro', priceCents: 3990 }],
  },
  {
    orderNumber: 'SEED-NP-0011',
    status: OrderStatus.PENDING,
    expectedDeliveryDate: '2026-11-11',
    createdAt: '2026-10-06T09:05:00.000Z',
    customerName: 'Karina Mendes',
    customerDocument: 'DEMO-0011',
    deliveryAddress: {
      street: 'Rua do Mercado',
      number: '1111',
      neighborhood: 'Centro',
      city: 'Salvador',
      state: 'BA',
      postalCode: '40010000',
    },
    items: [
      { description: 'Azeite', priceCents: 3290 },
      { description: 'Tempero', priceCents: 1190 },
    ],
  },
  {
    orderNumber: 'SEED-NP-0012',
    status: OrderStatus.PROCESSING,
    expectedDeliveryDate: '2026-11-12',
    createdAt: '2026-10-06T18:30:00.000Z',
    customerName: 'Lucas Barros',
    customerDocument: 'DEMO-0012',
    deliveryAddress: {
      street: 'Rua do Porto',
      number: '1212',
      neighborhood: 'Navegantes',
      city: 'Florianópolis',
      state: 'SC',
      postalCode: '88010000',
    },
    items: [
      { description: 'Protetor solar', priceCents: 5990 },
      { description: 'Chapéu', priceCents: 4590 },
      { description: 'Óculos', priceCents: 12990 },
    ],
  },
] as const;

export async function seedDemoData(
  prisma: Pick<PrismaClient, 'user' | 'order'>,
  config: SeedConfig,
  hashPassword: (password: string) => Promise<string> = argon2.hash,
): Promise<void> {
  const email = config.SEED_USER_EMAIL.trim().toLowerCase();
  const passwordHash = await hashPassword(config.SEED_USER_PASSWORD);

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  for (const fixture of demoOrderFixtures) {
    const existing = await prisma.order.findUnique({
      where: { orderNumber: fixture.orderNumber },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.order.create({
      data: {
        orderNumber: fixture.orderNumber,
        status: fixture.status,
        expectedDeliveryDate: new Date(`${fixture.expectedDeliveryDate}T00:00:00.000Z`),
        customerName: fixture.customerName,
        customerDocument: fixture.customerDocument,
        deliveryAddress: fixture.deliveryAddress,
        createdAt: new Date(fixture.createdAt),
        items: { create: fixture.items.map((item) => ({ ...item })) },
      },
    });
  }
}

async function main(): Promise<void> {
  let prisma: PrismaClient | undefined;
  try {
    const config = loadSeedConfig();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: config.DATABASE_URL }),
    });
    await seedDemoData(prisma, config);
    console.info('Demo seed completed.');
  } catch {
    console.error('Demo seed failed. Check seed configuration and database availability.');
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main();
}
