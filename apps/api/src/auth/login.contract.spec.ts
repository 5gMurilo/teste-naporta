import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';
import { createAppModule } from '../app.module.js';
import { loadApiConfig } from '../config/env.js';
import { PrismaService } from '../prisma/prisma.service.js';

describe('POST /api/v1/auth/login OpenAPI contract', () => {
  let app: INestApplication;

  beforeAll(async () => {
    jest.spyOn(PrismaService.prototype, 'onModuleInit').mockResolvedValue();
    const module = await Test.createTestingModule({
      imports: [
        createAppModule(
          loadApiConfig({
            NODE_ENV: 'test',
            DATABASE_URL: 'postgresql://localhost/db',
            JWT_SECRET: 'a'.repeat(32),
            JWT_ISSUER: 'naporta',
            JWT_AUDIENCE: 'naporta-web',
            JWT_EXPIRES_IN: '3600',
            REDIS_URL: 'redis://localhost:6379',
          }),
        ),
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    jest.restoreAllMocks();
  });

  it('documents strict request and response schemas, examples, and error responses', () => {
    const document = JSON.parse(
      JSON.stringify(
        SwaggerModule.createDocument(app, new DocumentBuilder().setTitle('naPorta').build()),
      ),
    ) as LoginDocument;
    const operation = document.paths['/api/v1/auth/login']?.post;
    if (!operation) throw new Error('login operation is missing from the OpenAPI document');
    const schemas = document.components.schemas;

    const requestSchema = operation.requestBody.content['application/json']?.schema;
    expect(JSON.stringify(requestSchema)).toContain('#/components/schemas/LoginRequest');
    expect(schemas.LoginRequest).toMatchObject({
      type: 'object',
      required: ['email', 'password'],
      additionalProperties: false,
    });
    expect(schemas.LoginRequest?.properties?.email?.format).toBe('email');
    expect(schemas.LoginRequest?.properties?.password?.minLength).toBe(1);

    const okSchema = operation.responses['200']?.content['application/json']?.schema;
    expect(JSON.stringify(okSchema)).toContain('LoginResponse');
    expect(schemas.LoginResponse?.properties?.tokenType).toEqual({
      type: 'string',
      enum: ['Bearer'],
    });
    expect(Object.keys(operation.responses).sort()).toEqual(['200', '400', '401', '500']);
    expect(operation.responses['401']?.content['application/problem+json']?.example?.code).toBe(
      'INVALID_CREDENTIALS',
    );
  });
});

type Property = { format?: string; minLength?: number; type?: string; enum?: string[] };
type LoginDocument = {
  paths: Record<
    string,
    {
      post?: {
        requestBody: { content: Record<string, { schema?: unknown }> };
        responses: Record<
          string,
          { content: Record<string, { schema?: unknown; example?: { code?: string } }> }
        >;
      };
    }
  >;
  components: {
    schemas: Record<
      string,
      {
        type?: string;
        required?: string[];
        additionalProperties?: boolean;
        properties?: Record<string, Property>;
      }
    >;
  };
};
