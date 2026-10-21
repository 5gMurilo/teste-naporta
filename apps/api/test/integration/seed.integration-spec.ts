import { execFileSync } from 'node:child_process';
import * as argon2 from 'argon2';
import { loadApiConfig } from '../../src/config/env.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

function runSeed(password: string, email = 'Demo@Example.Test'): string {
  return execFileSync('pnpm', ['exec', 'prisma', 'db', 'seed'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      SEED_USER_EMAIL: email,
      SEED_USER_PASSWORD: password,
    },
    encoding: 'utf8',
  });
}

describe('PostgreSQL seed integration', () => {
  it('is repeatable with one user, twelve orders, fixture items, all statuses, and three UTC days', async () => {
    const firstOutput = runSeed('first-demo-password');
    const secondOutput = runSeed('first-demo-password');
    expect(firstOutput + secondOutput).not.toContain('first-demo-password');
    expect(firstOutput + secondOutput).not.toContain('$argon2id$');

    const prisma = new PrismaService(loadApiConfig());
    await prisma.$connect();
    try {
      expect(await prisma.user.count({ where: { email: 'demo@example.test' } })).toBe(1);

      const orders = await prisma.order.findMany({
        orderBy: { orderNumber: 'asc' },
        include: { items: true },
      });
      expect(orders).toHaveLength(12);
      expect(orders.map((order) => order.orderNumber)).toEqual(
        Array.from({ length: 12 }, (_, index) => `SEED-NP-${String(index + 1).padStart(4, '0')}`),
      );
      expect(orders.every((order) => order.items.length >= 1 && order.items.length <= 3)).toBe(
        true,
      );
      expect(new Set(orders.map((order) => order.status))).toEqual(
        new Set(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELED']),
      );
      expect(
        new Set(orders.map((order) => order.createdAt.toISOString().slice(0, 10))).size,
      ).toBeGreaterThanOrEqual(3);

      const user = await prisma.user.findUniqueOrThrow({ where: { email: 'demo@example.test' } });
      expect(await argon2.verify(user.passwordHash, 'first-demo-password')).toBe(true);
    } finally {
      await prisma.$disconnect();
    }
  });

  it('updates the password while preserving external and soft-deleted reserved orders with their items', async () => {
    const prisma = new PrismaService(loadApiConfig());
    await prisma.$connect();
    let reservedId: string;
    let externalId: string;
    const deletedAt = new Date('2026-10-10T00:00:00.000Z');
    try {
      const reserved = await prisma.order.create({
        data: {
          orderNumber: 'SEED-NP-0001',
          status: 'CANCELED',
          expectedDeliveryDate: new Date('2026-11-01T00:00:00.000Z'),
          customerName: 'Existing seed record',
          customerDocument: 'KEEP-RESERVED',
          deliveryAddress: { street: 'Original reserved address' },
          deletedAt,
          cacheRevision: 9,
          items: { create: [{ description: 'Keep reserved item', priceCents: 321 }] },
        },
        include: { items: true },
      });
      reservedId = reserved.id;

      const external = await prisma.order.create({
        data: {
          orderNumber: 'EXTERNAL-DO-NOT-TOUCH',
          status: 'SHIPPED',
          expectedDeliveryDate: new Date('2026-11-02T00:00:00.000Z'),
          customerName: 'External record',
          customerDocument: 'KEEP-EXTERNAL',
          deliveryAddress: { street: 'Original external address' },
          items: { create: [{ description: 'Keep external item', priceCents: 654 }] },
        },
        include: { items: true },
      });
      externalId = external.id;
    } finally {
      await prisma.$disconnect();
    }

    runSeed('old-demo-password');
    const oldUser = new PrismaService(loadApiConfig());
    await oldUser.$connect();
    let oldPasswordHash: string;
    try {
      oldPasswordHash = (
        await oldUser.user.findUniqueOrThrow({ where: { email: 'demo@example.test' } })
      ).passwordHash;
    } finally {
      await oldUser.$disconnect();
    }

    const output = runSeed('new-demo-password');
    expect(output).not.toContain('new-demo-password');
    expect(output).not.toContain('$argon2id$');

    const verification = new PrismaService(loadApiConfig());
    await verification.$connect();
    try {
      const users = await verification.user.findMany({ where: { email: 'demo@example.test' } });
      expect(users).toHaveLength(1);
      expect(users[0].passwordHash).not.toBe(oldPasswordHash);
      expect(await argon2.verify(users[0].passwordHash, 'old-demo-password')).toBe(false);
      expect(await argon2.verify(users[0].passwordHash, 'new-demo-password')).toBe(true);

      const reserved = await verification.order.findUniqueOrThrow({
        where: { orderNumber: 'SEED-NP-0001' },
        include: { items: true },
      });
      expect(reserved.id).toBe(reservedId);
      expect(reserved.deletedAt).toEqual(deletedAt);
      expect(reserved.cacheRevision).toBe(9);
      expect(reserved.customerDocument).toBe('KEEP-RESERVED');
      expect(
        reserved.items.map(({ description, priceCents }) => ({ description, priceCents })),
      ).toEqual([{ description: 'Keep reserved item', priceCents: 321 }]);

      const external = await verification.order.findUniqueOrThrow({
        where: { orderNumber: 'EXTERNAL-DO-NOT-TOUCH' },
        include: { items: true },
      });
      expect(external.id).toBe(externalId);
      expect(external.deletedAt).toBeNull();
      expect(external.customerDocument).toBe('KEEP-EXTERNAL');
      expect(
        external.items.map(({ description, priceCents }) => ({ description, priceCents })),
      ).toEqual([{ description: 'Keep external item', priceCents: 654 }]);
    } finally {
      await verification.$disconnect();
    }
  });
});
