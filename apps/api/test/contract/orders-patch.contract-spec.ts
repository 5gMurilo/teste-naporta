import { exportOpenApi } from '../../src/docs/export-openapi.js';

type Operation = {
  security?: unknown[];
  requestBody?: { content: Record<string, { schema?: unknown }> };
  responses: Record<string, { content?: Record<string, unknown> }>;
};

describe('PATCH /api/v1/orders/{id} OpenAPI contract', () => {
  let operation: Operation;
  let schemas: Record<string, { required?: string[]; additionalProperties?: boolean }>;

  beforeAll(async () => {
    const doc = JSON.parse(await exportOpenApi());
    operation = doc.paths['/api/v1/orders/{id}'].patch;
    schemas = doc.components.schemas;
  });

  it('is bearer protected with a strict UpdateOrderRequest where no field is required', () => {
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(JSON.stringify(operation.requestBody?.content['application/json']?.schema)).toContain(
      'UpdateOrderRequest',
    );
    expect(schemas.UpdateOrderRequest?.additionalProperties).toBe(false);
    expect(schemas.UpdateOrderRequest?.required ?? []).toEqual([]);
  });

  it('documents 200 OrderResponse and the 400, 401, 404, 409, and 500 problems', () => {
    expect(Object.keys(operation.responses).sort()).toEqual([
      '200',
      '400',
      '401',
      '404',
      '409',
      '500',
    ]);
    expect(JSON.stringify(operation.responses['200']?.content)).toContain('OrderResponse');
    for (const status of ['400', '401', '404', '409', '500']) {
      expect(operation.responses[status]?.content).toHaveProperty('application/problem+json');
    }
  });
});
