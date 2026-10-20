import { jest } from "@jest/globals";
import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

jest.setTimeout(180_000);

let container: StartedPostgreSqlContainer | undefined;
const previousDatabaseUrl = process.env.DATABASE_URL;

function restoreDatabaseUrl() {
	if (previousDatabaseUrl === undefined) {
		delete process.env.DATABASE_URL;
	} else {
		process.env.DATABASE_URL = previousDatabaseUrl;
	}
}

beforeAll(async () => {
	try {
		container = await new PostgreSqlContainer("postgres:17-alpine")
			.withDatabase("teste_naporta_test")
			.withUsername("postgres")
			.withPassword("postgres")
			.withStartupTimeout(120_000)
			.start();
		process.env.DATABASE_URL = container.getConnectionUri();
	} catch (error) {
		try {
			await container?.stop();
		} finally {
			restoreDatabaseUrl();
		}
		throw error;
	}
});

afterAll(async () => {
	try {
		await container?.stop();
	} finally {
		restoreDatabaseUrl();
	}
});
