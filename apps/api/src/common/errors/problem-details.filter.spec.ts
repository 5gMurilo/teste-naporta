import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ProblemProbeController } from '../../../test/helpers/problem-probe.controller.js';
import { configureApplication } from '../../application.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('ProblemDetailsFilter over HTTP', () => {
  let app: INestApplication;
  const logger = { error: jest.fn<(message: string) => void>() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProblemProbeController],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app, logger);
    await app.init();
  });
  beforeEach(() => logger.error.mockClear());
  afterAll(async () => app.close());

  it('returns validation problem details with field errors, request id, and no input values', async () => {
    const response = await request(app.getHttpServer())
      .post('/probe/validate?token=query-secret')
      .send({ email: 'not-an-email', password: 'short', extra: 'leak-sentinel' })
      .expect(400);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'VALIDATION_ERROR',
      instance: '/probe/validate',
    });
    expect(response.body.requestId).toMatch(UUID);
    expect(response.headers['x-request-id']).toBe(response.body.requestId);
    expect(response.body.errors.map((e: { field: string }) => e.field).sort()).toEqual([
      'email',
      'extra',
      'password',
    ]);
    const raw = JSON.stringify(response.body);
    for (const sentinel of ['not-an-email', 'short', 'leak-sentinel', 'query-secret']) {
      expect(raw).not.toContain(sentinel);
    }
  });

  it('maps malformed JSON to a validation problem', async () => {
    const response = await request(app.getHttpServer())
      .post('/probe/validate')
      .set('Content-Type', 'application/json')
      .send('{"broken"')
      .expect(400);

    expect(response.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('maps 401 and 503 to their matrix codes without leaking the exception message', async () => {
    const unauthorized = await request(app.getHttpServer()).get('/probe/unauthorized').expect(401);
    const unavailable = await request(app.getHttpServer()).get('/probe/unavailable').expect(503);

    expect(unauthorized.body.code).toBe('UNAUTHORIZED');
    expect(unavailable.body.code).toBe('SERVICE_UNAVAILABLE');
    expect(JSON.stringify([unauthorized.body, unavailable.body])).not.toMatch(
      /internal token detail|ECONNREFUSED|10\.0\.0\.1/,
    );
  });

  it('preserves the status of native exceptions outside the matrix as HTTP_ERROR', async () => {
    const forbidden = await request(app.getHttpServer()).get('/probe/forbidden').expect(403);
    const missing = await request(app.getHttpServer()).get('/probe/nope').expect(404);

    expect(forbidden.body).toMatchObject({ status: 403, code: 'HTTP_ERROR', title: 'Forbidden' });
    expect(missing.body).toMatchObject({
      status: 404,
      code: 'HTTP_ERROR',
      instance: '/probe/nope',
    });
    expect(JSON.stringify(forbidden.body)).not.toContain('internal forbidden detail');
  });

  it('serializes domain errors and Prisma order number conflicts as 409', async () => {
    const conflict = await request(app.getHttpServer()).get('/probe/conflict').expect(409);

    expect(conflict.body).toMatchObject({
      status: 409,
      code: 'ORDER_NUMBER_ALREADY_EXISTS',
      title: 'Conflict',
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('maps only the orderNumber Prisma unique violation to 409 and hides other Prisma failures', async () => {
    const order = await request(app.getHttpServer())
      .get('/probe/prisma-order-conflict')
      .expect(409);
    const email = await request(app.getHttpServer())
      .get('/probe/prisma-email-conflict')
      .expect(500);

    expect(order.body.code).toBe('ORDER_NUMBER_ALREADY_EXISTS');
    expect(email.body.code).toBe('INTERNAL_SERVER_ERROR');
    expect(JSON.stringify([order.body, email.body])).not.toMatch(/SELECT|leaked/);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('returns a generic 500 and logs only request id, method, and route', async () => {
    const response = await request(app.getHttpServer())
      .get('/probe/boom?apiKey=query-secret')
      .set('Authorization', 'Bearer header-secret')
      .expect(500);

    expect(response.body).toMatchObject({
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      title: 'Internal Server Error',
      detail: 'An unexpected error occurred.',
      instance: '/probe/boom',
    });
    expect(JSON.stringify(response.body)).not.toMatch(/hunter2|SELECT|Bearer|query-secret/);
    expect(logger.error).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(logger.error.mock.calls[0]?.[0] ?? '{}');
    expect(entry).toEqual({
      event: 'request_failed',
      requestId: response.body.requestId,
      method: 'GET',
      route: '/probe/boom',
      status: 500,
      errorName: 'Error',
    });
    expect(logger.error.mock.calls[0]?.[0]).not.toMatch(
      /hunter2|SELECT|Bearer|header-secret|query-secret/,
    );
  });

  it('keeps the status of client errors raised by the body parser before any route runs (ERR-08)', async () => {
    const tooLarge = await request(app.getHttpServer())
      .post('/probe/validate')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'a@b.co', password: 'x'.repeat(200_000) }))
      .expect(413);
    const badCharset = await request(app.getHttpServer())
      .post('/probe/validate')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'x-unknown')
      .send('{}')
      .expect(415);

    expect(tooLarge.headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(tooLarge.body).toMatchObject({
      status: 413,
      code: 'HTTP_ERROR',
      title: 'Payload Too Large',
    });
    expect(badCharset.body).toMatchObject({ status: 415, code: 'HTTP_ERROR' });
    expect(JSON.stringify([tooLarge.body, badCharset.body])).not.toMatch(/xxxx|x-unknown|limit/i);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs the error class and driver code, never the message, for unexpected failures', async () => {
    await request(app.getHttpServer()).get('/probe/prisma-email-conflict').expect(500);

    const entry = JSON.parse(logger.error.mock.calls[0]?.[0] ?? '{}');
    expect(entry).toMatchObject({
      status: 500,
      errorName: 'PrismaClientKnownRequestError',
      errorCode: 'P2002',
    });
    expect(logger.error.mock.calls[0]?.[0]).not.toMatch(/SELECT|leaked/);
  });
});
