import { jest } from '@jest/globals';
import { demoOrderFixtures, seedDemoData } from '../../prisma/seed.js';
import { loadSeedConfig } from '../../src/config/env.js';

const config = loadSeedConfig({
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/test',
  SEED_USER_EMAIL: 'Demo@Example.Test',
  SEED_USER_PASSWORD: 'test-password',
});

function createPrisma() {
  return {
    user: { upsert: jest.fn(async () => ({ id: 'user-id' })) },
    order: {
      findUnique: jest.fn(async () => null as { id: string } | null),
      create: jest.fn(async (_args: { data: Record<string, unknown> }) => ({ id: 'order-id' })),
    },
  };
}

describe('seedDemoData', () => {
  it('normalizes the user email and persists only the generated hash', async () => {
    const prisma = createPrisma();

    await seedDemoData(prisma as never, config, async () => 'argon2id-hash');

    expect(prisma.user.upsert).toHaveBeenCalledWith({
      where: { email: 'demo@example.test' },
      update: { passwordHash: 'argon2id-hash' },
      create: { email: 'demo@example.test', passwordHash: 'argon2id-hash' },
    });
  });

  it('does not write user or order data when password hashing fails', async () => {
    const prisma = createPrisma();
    const failure = new Error('hash failed');

    await expect(
      seedDemoData(prisma as never, config, async () => Promise.reject(failure)),
    ).rejects.toBe(failure);

    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('leaves every existing reserved order unchanged', async () => {
    const prisma = createPrisma();
    prisma.order.findUnique.mockResolvedValue({ id: 'existing-order' });

    await seedDemoData(prisma as never, config, async () => 'argon2id-hash');

    expect(prisma.order.findUnique).toHaveBeenCalledTimes(12);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('creates absent reserved orders with their complete item fixtures', async () => {
    const prisma = createPrisma();

    await seedDemoData(prisma as never, config, async () => 'argon2id-hash');

    expect(demoOrderFixtures).toHaveLength(12);
    expect(prisma.order.create).toHaveBeenCalledTimes(12);
    const firstOrder = prisma.order.create.mock.calls[0]?.[0].data;
    expect(firstOrder?.orderNumber).toBe('SEED-NP-0001');
    expect(firstOrder?.items).toEqual({
      create: [
        { description: 'Café especial', priceCents: 4990 },
        { description: 'Caneca', priceCents: 0 },
      ],
    });
  });

  it('does not create orders when the user upsert fails', async () => {
    const prisma = createPrisma();
    const failure = new Error('user persistence failed');
    prisma.user.upsert.mockRejectedValue(failure);

    await expect(seedDemoData(prisma as never, config, async () => 'argon2id-hash')).rejects.toBe(
      failure,
    );

    expect(prisma.order.findUnique).not.toHaveBeenCalled();
    expect(prisma.order.create).not.toHaveBeenCalled();
  });
});
