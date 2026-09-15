import { randomUUID } from 'node:crypto';
import { db } from '$lib/server/db';
import {
	brands,
	customers,
	inventoryLots,
	inventoryMovements,
	materials,
	products,
	purchaseOrderItems,
	purchaseOrders,
	quotes,
	saleItems,
	sales,
	suppliers,
	users
} from '$lib/server/db/schema';
import {
	CurrencyCode,
	InventoryMovementType,
	MovementReferenceType,
	PurchaseOrderItemType,
	PurchaseOrderStatus,
	UserRole
} from '$lib/shared/enums';
import { SaleItemType } from '$lib/shared/enums/lensTypes';

function runId(): string {
	return randomUUID().slice(0, 8);
}

let orderCounter = 0;

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

export async function createSale(overrides: Partial<typeof sales.$inferInsert> = {}) {
	orderCounter += 1;
	const sellerId = overrides.sellerId ?? (await createUser()).id;
	const customerId = overrides.customerId ?? (await createCustomer()).id;
	const [row] = await db
		.insert(sales)
		.values({
			orderNumber: orderCounter,
			customerId,
			sellerId,
			subtotal: 100,
			snapshotTaxRate: 16,
			total: 100,
			...overrides
		})
		.returning();
	return row;
}

export async function createPurchaseOrder(
	overrides: Partial<typeof purchaseOrders.$inferInsert> = {}
) {
	orderCounter += 1;
	const supplierId = overrides.supplierId ?? (await createSupplier()).id;
	const createdById = overrides.createdById ?? (await createUser({ role: UserRole.ADMIN })).id;
	const [row] = await db
		.insert(purchaseOrders)
		.values({
			orderNumber: orderCounter,
			supplierId,
			status: PurchaseOrderStatus.CONFIRMED,
			orderDate: new Date().toISOString(),
			bcvRate: 40,
			settlementCurrency: CurrencyCode.USD_BCV,
			settlementGrossAmount: 100,
			settlementDebtAmount: 100,
			settlementDebtAmountUsdBcvAtOrder: 100,
			createdById,
			...overrides
		})
		.returning();
	return row;
}

export async function createPurchaseOrderItem(
	overrides: Partial<typeof purchaseOrderItems.$inferInsert> = {}
) {
	orderCounter += 1;
	const purchaseOrderId = overrides.purchaseOrderId ?? (await createPurchaseOrder()).id;
	const [row] = await db
		.insert(purchaseOrderItems)
		.values({
			purchaseOrderId,
			lineNumber: orderCounter,
			itemType: PurchaseOrderItemType.PRODUCT,
			quantity: 1,
			unitPurchasePrice: 10,
			unitSalePrice: 20,
			...overrides
		})
		.returning();
	return row;
}

export async function createInventoryLot(
	overrides: Partial<typeof inventoryLots.$inferInsert> = {}
) {
	orderCounter += 1;
	const purchaseOrderItemId = overrides.purchaseOrderItemId ?? (await createPurchaseOrderItem()).id;
	const [row] = await db
		.insert(inventoryLots)
		.values({
			lotNumber: orderCounter,
			purchaseOrderItemId,
			itemType: 'PRODUCT',
			quantityInitial: 10,
			quantityAvailable: 10,
			unitPurchasePrice: 10,
			unitSalePrice: 20,
			bcvRateAtPurchase: 40,
			...overrides
		})
		.returning();
	return row;
}

export async function createSaleItem(overrides: Partial<typeof saleItems.$inferInsert> = {}) {
	const saleId = overrides.saleId ?? (await createSale()).id;
	const [row] = await db
		.insert(saleItems)
		.values({
			saleId,
			itemType: SaleItemType.PRODUCT,
			quantity: 1,
			unitPrice: 20,
			...overrides
		})
		.returning();
	return row;
}

export async function createInventoryMovement(
	overrides: Partial<typeof inventoryMovements.$inferInsert> = {}
) {
	const lotId = overrides.lotId ?? (await createInventoryLot()).id;
	const createdById = overrides.createdById ?? (await createUser()).id;
	const [row] = await db
		.insert(inventoryMovements)
		.values({
			movementType: InventoryMovementType.ADJUSTMENT_IN,
			lotId,
			itemType: 'PRODUCT',
			quantityDelta: 1,
			quantityBefore: 0,
			quantityAfter: 1,
			referenceType: MovementReferenceType.MANUAL_ADJUSTMENT,
			referenceId: lotId,
			createdById,
			...overrides
		})
		.returning();
	return row;
}

export async function createQuote(overrides: Partial<typeof quotes.$inferInsert> = {}) {
	orderCounter += 1;
	const sellerId = overrides.sellerId ?? (await createUser()).id;
	const [row] = await db
		.insert(quotes)
		.values({
			quoteNumber: orderCounter,
			sellerId,
			quoteDate: new Date().toISOString(),
			subtotal: 100,
			snapshotTaxRate: 16,
			total: 100,
			...overrides
		})
		.returning();
	return row;
}
