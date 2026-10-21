import { exportOpenApi } from '../../src/docs/export-openapi.js';

type Content = Record<string, { schema?: unknown; example?: unknown }>;
type Operation = {
  security?: unknown[];
  requestBody?: { content: Content };
  responses: Record<string, { headers?: Record<string, unknown>; content?: Content }>;
};

describe('POST /api/v1/orders OpenAPI contract', () => {
  let operation: Operation;
  let schemas: Record<string, { required?: string[]; additionalProperties?: boolean }>;

  beforeAll(async () => {
    const doc = JSON.parse(await exportOpenApi());
    operation = doc.paths['/api/v1/orders'].post;
    schemas = doc.components.schemas;
  });

  it('requires bearer auth and references the strict CreateOrderRequest with an example', () => {
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    const body = operation.requestBody?.content['application/json'];
    expect(JSON.stringify(body?.schema)).toContain('CreateOrderRequest');
    expect(schemas.CreateOrderRequest?.additionalProperties).toBe(false);
    expect(schemas.CreateOrderRequest?.required).toEqual(
      expect.arrayContaining(['orderNumber', 'expectedDeliveryDate', 'customer', 'items']),
    );
  });

  it('documents 201 with Location and OrderResponse, plus 400, 401, 409, and 500 problems', () => {
    expect(Object.keys(operation.responses).sort()).toEqual(['201', '400', '401', '409', '500']);
    expect(operation.responses['201']?.headers).toHaveProperty('Location');
    expect(JSON.stringify(operation.responses['201']?.content)).toContain('OrderResponse');
    expect(schemas.OrderResponse?.required).toEqual(
      expect.arrayContaining(['id', 'totalCents', 'items', 'createdAt', 'updatedAt']),
    );
    for (const status of ['400', '401', '409', '500']) {
      expect(operation.responses[status]?.content).toHaveProperty('application/problem+json');
    }
    const conflict = operation.responses['409']?.content?.['application/problem+json'];
    expect(JSON.stringify(conflict?.example)).toContain('ORDER_NUMBER_ALREADY_EXISTS');
  });
});
