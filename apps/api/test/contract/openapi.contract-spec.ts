import { readFile } from 'node:fs/promises';
import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApplication } from '../../src/application.js';
import { loadApiConfig } from '../../src/config/env.js';
import { exportOpenApi, OPENAPI_PATH } from '../../src/docs/export-openapi.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

type Operation = { security?: unknown[]; responses: Record<string, unknown> };
type Doc = {
  openapi: string;
  paths: Record<string, Record<string, Operation>>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
};

// Every operation of the public contract; extend as endpoints are delivered.
const OPERATIONS = [
  'DELETE /api/v1/orders/{id}',
  'GET /api/v1/health',
  'GET /api/v1/orders',
  'GET /api/v1/orders/{id}',
  'PATCH /api/v1/orders/{id}',
  'POST /api/v1/auth/login',
  'POST /api/v1/orders',
];
const PATHS = ['/api/v1/auth/login', '/api/v1/health', '/api/v1/orders', '/api/v1/orders/{id}'];

const PUBLIC_OPERATIONS = ['POST /api/v1/auth/login', 'GET /api/v1/health'];

function operationsOf(doc: Doc): [string, Operation][] {
  return Object.entries(doc.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]): [string, Operation] => [
      `${method.toUpperCase()} ${path}`,
      op,
    ]),
  );
}

describe('OpenAPI document and export', () => {
  let generated: string;
  let doc: Doc;

  beforeAll(async () => {
    generated = await exportOpenApi();
    doc = JSON.parse(generated) as Doc;
  });

  it('is an OpenAPI 3.x document with only versioned operations and the bearerAuth scheme', () => {
    expect(doc.openapi).toMatch(/^3\./);
    expect(
      operationsOf(doc)
        .map(([name]) => name)
        .sort(),
    ).toEqual(OPERATIONS);
    expect(doc.components.securitySchemes.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
  });

  it('registers separate named request, response, and problem schemas', () => {
    for (const name of [
      'LoginRequest',
      'LoginResponse',
      'ProblemDetails',
      'ValidationProblemDetails',
    ]) {
      expect(doc.components.schemas[name]).toBeDefined();
    }
    const validation = doc.components.schemas.ValidationProblemDetails as { required: string[] };
    const problem = doc.components.schemas.ProblemDetails as { required: string[] };
    expect(problem.required).not.toContain('errors');
    expect(validation.required).toEqual(expect.arrayContaining([...problem.required, 'errors']));
  });

  it('requires bearerAuth on every operation except the explicitly public ones', () => {
    for (const [name, operation] of operationsOf(doc)) {
      if (PUBLIC_OPERATIONS.includes(name)) {
        expect(operation.security ?? []).toEqual([]);
      } else {
        expect(operation.security).toEqual([{ bearerAuth: [] }]);
      }
    }
  });

  it('documents 429 with Retry-After on login', () => {
    const login = doc.paths['/api/v1/auth/login'].post as Operation & {
      responses: Record<
        string,
        {
          headers?: Record<string, { schema?: { type?: string } }>;
          content?: Record<string, unknown>;
        }
      >;
    };
    const limited = login.responses['429'];

    expect(limited).toBeDefined();
    expect(limited.headers?.['Retry-After']?.schema?.type).toBe('integer');
    expect(Object.keys(limited.content ?? {})).toEqual(['application/problem+json']);
    expect(JSON.stringify(limited.content)).toContain('"status":429');
    expect(JSON.stringify(limited.content)).toContain('"code":"HTTP_ERROR"');
  });

  it('exports byte-identical documents on repeated runs without reading the environment', async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = 'postgresql://leak:leak-sentinel@unreachable.invalid:1/leak';
    try {
      const second = await exportOpenApi();
      expect(second).toBe(generated);
      expect(second).not.toContain('leak-sentinel');
      expect(second).not.toContain('documentation-only-placeholder-secret');
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });

  it('matches the versioned docs/openapi.json so contract drift fails the build', async () => {
    expect(await readFile(OPENAPI_PATH, 'utf8')).toBe(generated);
  });
});

describe('Swagger UI and JSON over HTTP', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.spyOn(PrismaService.prototype, 'onModuleInit').mockResolvedValue();
    app = await createApplication(
      loadApiConfig({
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://localhost/db',
        JWT_SECRET: 'a'.repeat(32),
        JWT_ISSUER: 'naporta',
        JWT_AUDIENCE: 'naporta-web',
        JWT_EXPIRES_IN: '3600',
        REDIS_URL: 'redis://127.0.0.1:1',
      }),
    );
  });
  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('serves /docs and /docs-json without a token while private routes still require one', async () => {
    const json = await request(app.getHttpServer()).get('/docs-json').expect(200);
    await request(app.getHttpServer()).get('/docs').redirects(1).expect(200);
    await request(app.getHttpServer()).get('/').expect(401);

    expect(json.body.openapi).toMatch(/^3\./);
    expect(Object.keys(json.body.paths).sort()).toEqual(PATHS);
  });

  it('serves the seven operations, bearerAuth and the nine named schemas', async () => {
    const json = await request(app.getHttpServer()).get('/docs-json').expect(200);
    const served = json.body as Doc;

    expect(
      operationsOf(served)
        .map(([name]) => name)
        .sort(),
    ).toEqual(OPERATIONS);
    expect(served.components.securitySchemes.bearerAuth).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    });
    expect(Object.keys(served.components.schemas)).toEqual(
      expect.arrayContaining([
        'LoginRequest',
        'LoginResponse',
        'CreateOrderRequest',
        'UpdateOrderRequest',
        'OrderResponse',
        'OrderSummaryResponse',
        'ListOrdersResponse',
        'ProblemDetails',
        'ValidationProblemDetails',
      ]),
    );
  });
});
