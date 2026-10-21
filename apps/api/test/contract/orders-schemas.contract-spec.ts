import { z } from 'zod';
import {
  createOrderRequestSchema,
  listOrdersQuerySchema,
  updateOrderRequestSchema,
} from '../../src/orders/schemas/orders.schemas.js';

type JsonSchema = {
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  minItems?: number;
  minProperties?: number;
  pattern?: string;
  maxItems?: number;
};

type Root = JsonSchema & { $ref?: string; $defs?: Record<string, JsonSchema> };

// Named schemas (meta id) are emitted as a root $ref into $defs; resolve it to inspect the shape.
function input(schema: z.ZodType): JsonSchema {
  const root = z.toJSONSchema(schema, { io: 'input', target: 'draft-2020-12' }) as Root;
  const name = root.$ref?.split('/').pop();
  return name ? (root.$defs?.[name] ?? root) : root;
}

describe('orders schemas as OpenAPI input', () => {
  it('keeps every list query entry as a scalar string before coercion', () => {
    const schema = input(listOrdersQuerySchema);

    expect(Object.keys(schema.properties ?? {}).sort()).toEqual([
      'createdFrom',
      'createdTo',
      'orderNumber',
      'page',
      'pageSize',
      'status',
    ]);
    for (const name of ['page', 'pageSize', 'createdFrom', 'createdTo', 'orderNumber']) {
      expect(schema.properties?.[name]?.type).toBe('string');
    }
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required ?? []).toEqual([]);
  });

  it('describes strict create and update bodies with item limits and no required PATCH fields', () => {
    const create = input(createOrderRequestSchema);
    const update = input(updateOrderRequestSchema);

    expect(create.required).toEqual(
      expect.arrayContaining([
        'orderNumber',
        'expectedDeliveryDate',
        'customer',
        'deliveryAddress',
        'items',
      ]),
    );
    expect(create.required).not.toContain('status');
    expect(create.additionalProperties).toBe(false);
    expect(create.properties?.items).toMatchObject({ type: 'array', minItems: 1, maxItems: 50 });
    expect(update.required ?? []).toEqual([]);
    expect(update.minProperties).toBe(1);
    expect(update.additionalProperties).toBe(false);
  });
});
