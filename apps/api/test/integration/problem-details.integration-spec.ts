import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApplication } from '../../src/application.js';
import { API_CONFIG, loadApiConfig } from '../../src/config/env.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

@Controller('probe')
class DatabaseProbeController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('duplicate-order')
  async duplicateOrder() {
    const data = {
      orderNumber: 'NP-DUP',
      expectedDeliveryDate: new Date('2026-11-01T00:00:00.000Z'),
      customerName: 'Customer',
      customerDocument: 'DOC-1',
      deliveryAddress: { street: 'Street' },
    };
    await this.prisma.order.create({ data });
    await this.prisma.order.create({ data });
  }

  @Get('orphan-item')
  async orphanItem() {
    await this.prisma.orderItem.create({
      data: {
        description: 'Item',
        priceCents: 1,
        orderId: '00000000-0000-4000-8000-000000000000',
      },
    });
  }
}

describe('ProblemDetailsFilter with PostgreSQL', () => {
  let app: INestApplication;
  const errors: string[] = [];

  beforeAll(async () => {
    const config = loadApiConfig();
    const module = await Test.createTestingModule({
      controllers: [DatabaseProbeController],
      providers: [{ provide: API_CONFIG, useValue: config }, PrismaService],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app, { error: (message) => errors.push(message) });
    await app.init();
  });
  beforeEach(() => {
    errors.length = 0;
  });
  afterAll(async () => app.close());

  it('turns a real duplicate order number into 409 ORDER_NUMBER_ALREADY_EXISTS', async () => {
    const response = await request(app.getHttpServer()).get('/probe/duplicate-order').expect(409);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      status: 409,
      code: 'ORDER_NUMBER_ALREADY_EXISTS',
      instance: '/probe/duplicate-order',
    });
    expect(response.body.requestId).toMatch(UUID);
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
    expect(errors).toHaveLength(0);
  });

  it('answers 500 with the problem details content type', async () => {
    const response = await request(app.getHttpServer()).get('/probe/orphan-item').expect(500);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({ status: 500, code: 'INTERNAL_SERVER_ERROR' });
  });

  it('hides a real foreign key violation behind a generic 500 and a safe log entry', async () => {
    const response = await request(app.getHttpServer()).get('/probe/orphan-item').expect(500);

    expect(response.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(JSON.stringify(response.body)).not.toMatch(/OrderItem|foreign key|INSERT|violates/i);
    expect(errors).toHaveLength(1);
    expect(errors[0]).not.toMatch(/OrderItem|foreign key|INSERT|violates/i);
    expect(JSON.parse(errors[0] as string)).toMatchObject({
      requestId: response.body.requestId,
      method: 'GET',
      route: '/probe/orphan-item',
    });
  });
});
