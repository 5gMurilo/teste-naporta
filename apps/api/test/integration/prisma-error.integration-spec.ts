import { OrderNumberAlreadyExistsError } from '../../src/common/errors/domain-errors.js';
import { mapPrismaError } from '../../src/common/errors/prisma-error.mapper.js';
import { loadApiConfig } from '../../src/config/env.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const orderData = (orderNumber: string) => ({
  orderNumber,
  expectedDeliveryDate: new Date('2026-11-01T00:00:00.000Z'),
  customerName: 'Customer',
  customerDocument: 'DOC-1',
  deliveryAddress: { street: 'Street' },
});

describe('Prisma error mapping against PostgreSQL', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    prisma = new PrismaService(loadApiConfig());
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('maps real duplicate order numbers on create, update, and after soft delete', async () => {
    await prisma.order.create({ data: orderData('NP-1') });
    const second = await prisma.order.create({ data: orderData('NP-2') });
    await prisma.order.create({ data: { ...orderData('NP-3'), deletedAt: new Date() } });

    const onCreate = await prisma.order.create({ data: orderData('NP-1') }).catch(mapPrismaError);
    const onUpdate = await prisma.order
      .update({ where: { id: second.id }, data: { orderNumber: 'NP-1' } })
      .catch(mapPrismaError);
    const afterDelete = await prisma.order
      .create({ data: orderData('NP-3') })
      .catch(mapPrismaError);

    for (const error of [onCreate, onUpdate, afterDelete]) {
      expect(error).toBeInstanceOf(OrderNumberAlreadyExistsError);
    }
  });

  it('leaves a real duplicate user email as the original Prisma error', async () => {
    await prisma.user.create({ data: { email: 'dup@example.test', passwordHash: 'hash' } });

    const error = await prisma.user
      .create({ data: { email: 'dup@example.test', passwordHash: 'hash' } })
      .catch(mapPrismaError);

    expect(error).not.toBeInstanceOf(OrderNumberAlreadyExistsError);
    expect((error as { code?: string }).code).toBe('P2002');
  });
});
