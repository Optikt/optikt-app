import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { cancelPurchaseOrder, confirmPurchaseOrder } from './lifecycle';
import { db } from '$lib/server/db';
import { inventoryLots, products } from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import {
	createMaterial,
	createProduct,
	createPurchaseOrder,
	createPurchaseOrderItem,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { PurchaseOrderStatus, UserRole } from '$lib/shared/enums';

async function seedDraftPo(
	options: { reviewed?: boolean; ready?: boolean; quantity?: number } = {}
) {
	const { reviewed = true, ready = true, quantity = 2 } = options;
	const admin = await createUser({ role: UserRole.ADMIN });
	const supplier = await createSupplier();
	const material = await createMaterial();
	const product = await createProduct({
		supplierId: supplier.id,
		materialId: material.id,
		stock: 0
	});
	const purchaseOrder = await createPurchaseOrder({
		supplierId: supplier.id,
		createdById: admin.id,
		status: PurchaseOrderStatus.DRAFT,
		isReadyForReview: ready
	});
	const item = await createPurchaseOrderItem({
		purchaseOrderId: purchaseOrder.id,
		productId: product.id,
		quantity,
		isReviewed: reviewed
	});
	return { admin, product, purchaseOrder, item };
}

describe('confirmPurchaseOrder', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('creates a lot, moves stock and confirms the order', async () => {
		const { admin, product, purchaseOrder, item } = await seedDraftPo({ quantity: 2 });

		const confirmed = await db.transaction((tx) =>
			confirmPurchaseOrder(purchaseOrder.id, admin.id, tx)
		);

		expect(confirmed.status).toBe(PurchaseOrderStatus.CONFIRMED);
		const [productAfter] = await db.select().from(products).where(eq(products.id, product.id));
		expect(productAfter.stock).toBe(2);
		const lots = await db
			.select()
			.from(inventoryLots)
			.where(eq(inventoryLots.purchaseOrderItemId, item.id));
		expect(lots).toHaveLength(1);
		expect(lots[0].quantityAvailable).toBe(2);
	});

	it('rejects an order that is not marked ready for review', async () => {
		const { admin, purchaseOrder } = await seedDraftPo({ ready: false });

		await expect(
			db.transaction((tx) => confirmPurchaseOrder(purchaseOrder.id, admin.id, tx))
		).rejects.toThrow('listo para revisar');
	});

	it('rejects an order with unreviewed lines', async () => {
		const { admin, purchaseOrder } = await seedDraftPo({ reviewed: false });

		await expect(
			db.transaction((tx) => confirmPurchaseOrder(purchaseOrder.id, admin.id, tx))
		).rejects.toThrow('por marcar como revisadas');
	});
});

describe('cancelPurchaseOrder', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('cancels a draft order', async () => {
		const { purchaseOrder } = await seedDraftPo();

		const cancelled = await cancelPurchaseOrder(purchaseOrder.id);

		expect(cancelled.status).toBe(PurchaseOrderStatus.CANCELLED);
	});

	it('rejects cancelling an already confirmed order', async () => {
		const { admin, purchaseOrder } = await seedDraftPo();
		await db.transaction((tx) => confirmPurchaseOrder(purchaseOrder.id, admin.id, tx));

		await expect(cancelPurchaseOrder(purchaseOrder.id)).rejects.toThrow();
	});
});
