import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { revertFullLotCore } from './revertFullLot';
import { db } from '$lib/server/db';
import { inventoryLots, products } from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import {
	createInventoryLot,
	createMaterial,
	createProduct,
	createPurchaseOrder,
	createPurchaseOrderItem,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { UserRole } from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.ADMIN, ipAddress: '127.0.0.1', userAgent: null };
}

async function seedLot(quantityAvailable = 10) {
	const admin = await createUser({ role: UserRole.ADMIN });
	const supplier = await createSupplier();
	const material = await createMaterial();
	const product = await createProduct({
		supplierId: supplier.id,
		materialId: material.id,
		stock: quantityAvailable
	});
	const purchaseOrder = await createPurchaseOrder({
		supplierId: supplier.id,
		createdById: admin.id
	});
	const item = await createPurchaseOrderItem({
		purchaseOrderId: purchaseOrder.id,
		productId: product.id
	});
	const lot = await createInventoryLot({
		purchaseOrderItemId: item.id,
		productId: product.id,
		quantityInitial: 10,
		quantityAvailable
	});
	return { admin, product, lot };
}

describe('revertFullLotCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('reverts an untouched lot and zeroes the cached stock', async () => {
		const { admin, product, lot } = await seedLot();

		const result = await revertFullLotCore({ lotId: lot.id }, ctx(admin.id));

		expect(result).toEqual({ success: true, lotId: lot.id });
		const [lotAfter] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lot.id));
		const [productAfter] = await db.select().from(products).where(eq(products.id, product.id));
		expect(lotAfter.quantityAvailable).toBe(0);
		expect(lotAfter.isActive).toBe(false);
		expect(productAfter.stock).toBe(0);
	});

	it('rejects a lot with consumed units', async () => {
		const { admin, lot } = await seedLot(7);

		const result = await revertFullLotCore({ lotId: lot.id }, ctx(admin.id));

		expect(result).toEqual({
			success: false,
			error: 'No se puede revertir: el lote tiene 3 unidades ya consumidas'
		});
	});

	it('returns not found for an unknown lot', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });

		const result = await revertFullLotCore({ lotId: crypto.randomUUID() }, ctx(admin.id));

		expect(result).toEqual({ success: false, error: 'Lote no encontrado' });
	});
});
