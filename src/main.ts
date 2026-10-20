import "reflect-metadata";
import "dotenv/config";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config/env.js";

async function bootstrap() {
	const config = loadConfig();
	const app = await NestFactory.create(AppModule);
	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			forbidNonWhitelisted: true,
		}),
	);
	app.enableShutdownHooks();
	await app.listen(config.PORT);
}

bootstrap().catch((error: unknown) => {
	console.error(error);
	process.exitCode = 1;
});
