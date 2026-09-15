import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import { brands, customers, materials, products, suppliers, users } from '$lib/server/db/schema';
import { UserRole } from '$lib/shared/enums';

function runId(): string {
	return randomUUID().slice(0, 8);
}

export async function createUser(overrides: Partial<typeof users.$inferInsert> = {}) {
	const id = runId();
	const [row] = await db
		.insert(users)
		.values({
			email: `it-${id}@optikt.test`,
			username: `it-${id}`,
			fullName: 'Integration User',
			hashedPassword: 'integration-test-not-a-real-hash',
			isSuperuser: false,
			role: UserRole.SELLER,
			...overrides
		})
		.returning();
	return row;
}

export async function createBrand(overrides: Partial<typeof brands.$inferInsert> = {}) {
	const id = runId();
	const [row] = await db
		.insert(brands)
		.values({ name: `Marca ${id}`, ...overrides })
		.returning();
	return row;
}

export async function createSupplier(overrides: Partial<typeof suppliers.$inferInsert> = {}) {
	const id = runId();
	const [row] = await db
		.insert(suppliers)
		.values({
			name: `Proveedor ${id}`,
			type: 'DISTRIBUTOR',
			primaryPhone: '04120000000',
			defaultCurrency: 'USD_BCV',
			...overrides
		})
		.returning();
	return row;
}

export async function createMaterial(overrides: Partial<typeof materials.$inferInsert> = {}) {
	const id = runId();
	const [row] = await db
		.insert(materials)
		.values({ name: `Material ${id}`, code: `MAT-${id}`, productType: 'FRAME', ...overrides })
		.returning();
	return row;
}

export async function createProduct(
	input: { supplierId: string; materialId: string } & Partial<typeof products.$inferInsert>
) {
	const { supplierId, materialId, ...overrides } = input;
	const id = runId();
	const [row] = await db
		.insert(products)
		.values({
			sku: `IT-${id}`,
			name: `Producto ${id}`,
			type: 'FRAME',
			supplierId,
			materialId,
			currentPurchasePrice: 10,
			currentSalePrice: 20,
			stock: 0,
			...overrides
		})
		.returning();
	return row;
}

export async function createCustomer(overrides: Partial<typeof customers.$inferInsert> = {}) {
	const id = runId();
	const [row] = await db
		.insert(customers)
		.values({
			firstName: 'Cliente',
			lastName: `IT ${id}`,
			primaryPhone: '04120000000',
			...overrides
		})
		.returning();
	return row;
}
