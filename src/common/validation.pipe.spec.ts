import {
	Body,
	Controller,
	INestApplication,
	Post,
	ValidationPipe,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { IsString } from "class-validator";
import request from "supertest";

class ExampleDto {
	@IsString()
	name!: string;
}

@Controller("fixture")
class FixtureController {
	@Post()
	create(@Body() body: ExampleDto) {
		return { isInstance: body instanceof ExampleDto, name: body.name };
	}
}

describe("global validation policy", () => {
	let app: INestApplication;
	beforeAll(async () => {
		const module = await Test.createTestingModule({
			controllers: [FixtureController],
		}).compile();
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

	it("transforms a valid payload to its DTO instance", async () => {
		await request(app.getHttpServer())
			.post("/fixture")
			.send({ name: "Ada" })
			.expect(201, { isInstance: true, name: "Ada" });
	});

	it("rejects undeclared properties with the standard 400 body", async () => {
		const response = await request(app.getHttpServer())
			.post("/fixture")
			.send({ name: "Ada", extra: true })
			.expect(400);
		expect(response.body).toMatchObject({
			statusCode: 400,
			error: "Bad Request",
		});
		expect(response.body.message).toEqual(
			expect.arrayContaining([expect.stringContaining("extra")]),
		);
	});

	it("rejects invalid decorated fields with the standard 400 body", async () => {
		const response = await request(app.getHttpServer())
			.post("/fixture")
			.send({ name: 42 })
			.expect(400);
		expect(response.body).toMatchObject({
			statusCode: 400,
			error: "Bad Request",
		});
		expect(response.body.message).toEqual(
			expect.arrayContaining([expect.stringContaining("name")]),
		);
	});
});
