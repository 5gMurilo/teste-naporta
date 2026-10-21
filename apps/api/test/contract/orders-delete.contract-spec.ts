import { exportOpenApi } from '../../src/docs/export-openapi.js';

type Operation = {
  security?: unknown[];
  responses: Record<string, { content?: Record<string, unknown> }>;
};

describe('DELETE /api/v1/orders/{id} OpenAPI contract', () => {
  let operation: Operation;

  beforeAll(async () => {
    operation = JSON.parse(await exportOpenApi()).paths['/api/v1/orders/{id}'].delete;
  });

  it('is bearer protected and documents 204 without any response body', () => {
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation.responses['204']).toBeDefined();
    expect(operation.responses['204']?.content).toBeUndefined();
  });

  it('documents the 400, 401, 404, and 500 problems', () => {
    expect(Object.keys(operation.responses).sort()).toEqual(['204', '400', '401', '404', '500']);
    for (const status of ['400', '401', '404', '500']) {
      expect(operation.responses[status]?.content).toHaveProperty('application/problem+json');
    }
  });
});
