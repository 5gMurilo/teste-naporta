import { exportOpenApi } from '../../src/docs/export-openapi.js';

type Parameter = { name: string; in: string; required?: boolean; schema?: { type?: string } };
type Operation = {
  security?: unknown[];
  parameters?: Parameter[];
  responses: Record<string, { content?: Record<string, unknown> }>;
};

describe('GET /api/v1/orders OpenAPI contract', () => {
  let operation: Operation;

  beforeAll(async () => {
    operation = JSON.parse(await exportOpenApi()).paths['/api/v1/orders'].get;
  });

  it('is bearer protected and documents each filter as an optional scalar string query parameter', () => {
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    const query = (operation.parameters ?? []).filter((parameter) => parameter.in === 'query');

    expect(query.map((parameter) => parameter.name).sort()).toEqual([
      'createdFrom',
      'createdTo',
      'orderNumber',
      'page',
      'pageSize',
      'status',
    ]);
    for (const parameter of query) {
      expect(parameter.required ?? false).toBe(false);
      expect(parameter.schema?.type).toBe('string');
    }
  });

  it('documents 200 ListOrdersResponse and the 400, 401, and 500 problems', () => {
    expect(Object.keys(operation.responses).sort()).toEqual(['200', '400', '401', '500']);
    expect(JSON.stringify(operation.responses['200']?.content)).toContain('ListOrdersResponse');
    for (const status of ['400', '401', '500']) {
      expect(operation.responses[status]?.content).toHaveProperty('application/problem+json');
    }
  });
});
