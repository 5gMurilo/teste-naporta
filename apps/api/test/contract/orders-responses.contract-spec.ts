import { z } from 'zod';
import {
  listOrdersResponseSchema,
  orderResponseSchema,
  orderSummaryResponseSchema,
} from '../../src/orders/dto/order.responses.js';

type JsonSchema = {
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  $ref?: string;
  $defs?: Record<string, JsonSchema>;
};

function output(schema: z.ZodType): JsonSchema {
  const root = z.toJSONSchema(schema, { io: 'output', target: 'draft-2020-12' }) as JsonSchema;
  const name = root.$ref?.split('/').pop();
  return name ? (root.$defs?.[name] ?? root) : root;
}

describe('order response schemas as OpenAPI output', () => {
  it('lists exactly the public fields of the detail response, all required and strict', () => {
    const detail = output(orderResponseSchema);
    const fields = [
      'id',
      'orderNumber',
      'status',
      'expectedDeliveryDate',
      'customer',
      'deliveryAddress',
      'items',
      'totalCents',
      'createdAt',
      'updatedAt',
    ];

    expect(Object.keys(detail.properties ?? {}).sort()).toEqual([...fields].sort());
    expect(detail.required?.sort()).toEqual([...fields].sort());
    expect(detail.additionalProperties).toBe(false);
    expect(JSON.stringify(detail)).not.toMatch(/cacheRevision|deletedAt|passwordHash/);
  });

  it('keeps the summary free of items, address, total, and updatedAt', () => {
    const summary = output(orderSummaryResponseSchema);

    expect(Object.keys(summary.properties ?? {}).sort()).toEqual(
      ['createdAt', 'customer', 'expectedDeliveryDate', 'id', 'orderNumber', 'status'].sort(),
    );
  });

  it('describes the list envelope with data and a complete meta block', () => {
    const list = output(listOrdersResponseSchema);

    expect(Object.keys(list.properties ?? {}).sort()).toEqual(['data', 'meta']);
    expect(Object.keys(list.properties?.meta?.properties ?? {}).sort()).toEqual([
      'page',
      'pageSize',
      'total',
      'totalPages',
    ]);
  });
});
