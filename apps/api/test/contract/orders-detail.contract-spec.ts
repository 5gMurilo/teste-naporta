import { exportOpenApi } from '../../src/docs/export-openapi.js';

type Operation = {
  security?: unknown[];
  parameters?: { name: string; in: string; required?: boolean }[];
  responses: Record<string, { content?: Record<string, unknown> }>;
};

describe('GET /api/v1/orders/{id} OpenAPI contract', () => {
  let operation: Operation;

  beforeAll(async () => {
    operation = JSON.parse(await exportOpenApi()).paths['/api/v1/orders/{id}'].get;
  });

  it('is a bearer protected operation with a required path id', () => {
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation.parameters).toContainEqual(
      expect.objectContaining({ name: 'id', in: 'path', required: true }),
    );
  });

  it('documents 200 OrderResponse and the 400, 401, 404, and 500 problems', () => {
    expect(Object.keys(operation.responses).sort()).toEqual(['200', '400', '401', '404', '500']);
    expect(JSON.stringify(operation.responses['200']?.content)).toContain('OrderResponse');
    for (const status of ['400', '401', '404', '500']) {
      expect(operation.responses[status]?.content).toHaveProperty('application/problem+json');
    }
  });
});
