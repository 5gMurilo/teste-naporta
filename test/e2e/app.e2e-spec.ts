import { jest } from "@jest/globals";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppController } from "../../src/app.controller.js";
import { PrismaService } from "../../src/prisma/prisma.service.js";

describe("GET /", () => {
	let app: INestApplication;
	beforeAll(async () => {
		const module = await Test.createTestingModule({
			controllers: [AppController],
			providers: [PrismaService],
		})
			.overrideProvider(PrismaService)
			.useValue({ $connect: jest.fn(), $disconnect: jest.fn() })
			.compile();
		app = module.createNestApplication();
		app.useGlobalPipes(
			new ValidationPipe({
				transform: true,
				whitelist: true,
				forbidNonWhitelisted: true,
			}),
		);
		await app.init();
	});
	afterAll(async () => app.close());
	it("returns Hello World!", async () => {
		await request(app.getHttpServer())
			.get("/")
			.expect(200)
			.expect("Hello World!");
	});
});
