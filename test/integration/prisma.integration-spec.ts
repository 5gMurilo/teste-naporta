import { PrismaService } from "../../src/prisma/prisma.service.js";

describe("PostgreSQL integration", () => {
	it("executes SELECT 1 against PostgreSQL", async () => {
		const prisma = new PrismaService();
		await prisma.$connect();
		try {
			const result = await prisma.$queryRaw<
				Array<{ result: number }>
			>`SELECT 1 AS result`;
			expect(Number(result[0].result)).toBe(1);
		} finally {
			await prisma.$disconnect();
		}
	});
});
