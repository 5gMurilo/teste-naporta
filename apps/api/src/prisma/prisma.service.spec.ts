import { jest } from "@jest/globals";
import { PrismaService } from "./prisma.service.js";

jest.mock("../generated/prisma/client", () => ({
	PrismaClient: class {
		$disconnect = jest.fn();
	},
}));
jest.mock("@prisma/adapter-pg", () => ({ PrismaPg: class {} }));

describe("PrismaService", () => {
	it("disconnects once on module shutdown", async () => {
		process.env.DATABASE_URL = "postgresql://localhost/db";
		const service = new PrismaService();
		const disconnect = jest.spyOn(service, "$disconnect");
		await service.onModuleDestroy();
		expect(disconnect).toHaveBeenCalledTimes(1);
	});
});
