import { execFileSync } from 'node:child_process';
import { loadApiConfig } from '../../src/config/env.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('PostgreSQL integration', () => {
  beforeAll(() => {
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    });
  });

  it('executes SELECT 1 against PostgreSQL', async () => {
    const prisma = new PrismaService(loadApiConfig());
    await prisma.$connect();
    try {
      const result = await prisma.$queryRaw<Array<{ result: number }>>`SELECT 1 AS result`;
      expect(Number(result[0].result)).toBe(1);

      const database = await prisma.$queryRaw<
        Array<{ database: string }>
      >`SELECT current_database() AS database`;
      expect(database[0].database).toBe('teste_naporta_test');
    } finally {
      await prisma.$disconnect();
    }
  });

  it('queries PostgreSQL through the compiled ESM Prisma client', () => {
    const output = execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '--eval',
        `import { loadApiConfig } from './dist/config/env.js';
         import { PrismaService } from './dist/prisma/prisma.service.js';
         const prisma = new PrismaService(loadApiConfig());
         await prisma.$connect();
         try {
           const rows = await prisma.$queryRaw\`SELECT 1 AS result, current_database() AS database\`;
           if (Number(rows[0].result) !== 1 || rows[0].database !== 'teste_naporta_test') {
             throw new Error('compiled Prisma query returned an unexpected result');
           }
           console.log('compiled Prisma ESM query passed');
         } finally {
           await prisma.$disconnect();
         }`,
      ],
      { cwd: process.cwd(), env: process.env, encoding: 'utf8' },
    );

    expect(output).toContain('compiled Prisma ESM query passed');
  });

  it('applies the order migration with the required PostgreSQL types and constraints', async () => {
    const prisma = new PrismaService(loadApiConfig());
    await prisma.$connect();
    try {
      const columns = await prisma.$queryRaw<
        Array<{
          table_name: string;
          column_name: string;
          data_type: string;
          udt_name: string;
          column_default: string | null;
        }>
      >`SELECT table_name, column_name, data_type, udt_name, column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name IN ('User', 'Order', 'OrderItem')`;
      const byColumn = new Map(
        columns.map((column) => [`${column.table_name}.${column.column_name}`, column]),
      );

      expect(byColumn.get('User.id')?.udt_name).toBe('uuid');
      expect(byColumn.get('User.createdAt')?.udt_name).toBe('timestamptz');
      expect(byColumn.get('Order.expectedDeliveryDate')?.udt_name).toBe('date');
      expect(byColumn.get('Order.deliveryAddress')?.udt_name).toBe('jsonb');
      expect(byColumn.get('Order.status')?.udt_name).toBe('OrderStatus');
      expect(byColumn.get('Order.cacheRevision')?.column_default).toContain('1');
      expect(byColumn.get('OrderItem.priceCents')?.udt_name).toBe('int4');

      const constraints = await prisma.$queryRaw<Array<{ conname: string; contype: string }>>`
        SELECT conname, contype::text AS contype
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
      `;
      expect(constraints).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ conname: 'OrderItem_orderId_fkey', contype: 'f' }),
        ]),
      );

      const indexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname FROM pg_indexes WHERE schemaname = 'public'
      `;
      expect(indexes.map((index) => index.indexname)).toEqual(
        expect.arrayContaining([
          'User_email_key',
          'Order_orderNumber_key',
          'OrderItem_orderId_idx',
          'Order_deletedAt_createdAt_id_idx',
        ]),
      );
    } finally {
      await prisma.$disconnect();
    }
  });
});
