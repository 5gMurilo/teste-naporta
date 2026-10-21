import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { createAppModule } from '../../src/app.module.js';
import { configureApplication } from '../../src/application.js';
import { loadApiConfig } from '../../src/config/env.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

describe('global JWT guard with PostgreSQL', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [createAppModule(loadApiConfig())],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app, { error: () => undefined });
    await app.init();
  });
  afterAll(async () => app.close());

  async function tokenFor(email: string, password: string) {
    await app.get(PrismaService).user.create({
      data: { email, passwordHash: await argon2.hash(password) },
    });
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    return response.body.accessToken as string;
  }

  it('accepts tokens issued by the real login for two different users on the private route', async () => {
    const first = await tokenFor('first@example.test', 'first-password');
    const second = await tokenFor('second@example.test', 'second-password');

    for (const token of [first, second]) {
      await request(app.getHttpServer())
        .get('/')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect('Hello World!');
    }
    await request(app.getHttpServer()).get('/').expect(401);
  });

  it('serves the public health route against the database without a token', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });
});
