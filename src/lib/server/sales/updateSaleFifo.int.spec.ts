import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq, isNull } from 'drizzle-orm';
import { updateSaleCore } from './updateSale';
import { db } from '$lib/server/db';
import { inventoryLots, inventoryMovements, products, saleItems } from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import {
	createInventoryLot,
	createInventoryMovement,
	createMaterial,
	createProduct,
	createPurchaseOrder,
	createPurchaseOrderItem,
	createSale,
	createSaleItem,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import {
	DiscountType,
	InventoryMovementType,
	MovementReferenceType,
	SaleItemType,
	UserRole
} from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.ADMIN, ipAddress: '127.0.0.1', userAgent: null };
}

function productItem(productId: string, quantity: number, unitPrice = 20) {
	return {
		itemType: SaleItemType.PRODUCT,
		productId,
		quantity,
		unitPrice,
		discount: 0,
		discountType: DiscountType.FIXED,
		snapshotIsTaxable: false
	};
}

describe('updateSaleCore — FIFO inventory replacement', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('reverts the consumed lot and re-consumes FIFO across lots', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const supplier = await createSupplier();
		const material = await createMaterial();
		const product = await createProduct({
			supplierId: supplier.id,
			materialId: material.id,
			stock: 5
		});
		const purchaseOrder = await createPurchaseOrder({
			supplierId: supplier.id,
			createdById: admin.id
		});
		const poItem = await createPurchaseOrderItem({
			purchaseOrderId: purchaseOrder.id,
			productId: product.id
		});

		// Older lot was fully consumed by the original sale; newer lot still has stock.
		const olderLot = await createInventoryLot({
			purchaseOrderItemId: poItem.id,
			productId: product.id,
			quantityInitial: 1,
			quantityAvailable: 0,
			isActive: false,
			createdAt: '2026-01-01T00:00:00.000Z'
		});
		const newerLot = await createInventoryLot({
			purchaseOrderItemId: poItem.id,
			productId: product.id,
			quantityInitial: 5,
			quantityAvailable: 5,
			createdAt: '2026-01-02T00:00:00.000Z'
		});

		const sale = await createSale({ sellerId: admin.id, subtotal: 20, total: 20 });
		await createSaleItem({
			saleId: sale.id,
			productId: product.id,
			lotId: olderLot.id,
			quantity: 1,
			unitPrice: 20
		});
		await createInventoryMovement({
			movementType: InventoryMovementType.SALE_OUT,
			lotId: olderLot.id,
			productId: product.id,
			quantityDelta: -1,
			quantityBefore: 1,
			quantityAfter: 0,
			referenceType: MovementReferenceType.SALE,
			referenceId: sale.id,
			createdById: admin.id
		});

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'cambio de montura', items: [productItem(product.id, 3)] },
			ctx(admin.id)
		);

		expect(result.success).toBe(true);

		const [olderAfter] = await db
			.select()
			.from(inventoryLots)
			.where(eq(inventoryLots.id, olderLot.id));
		const [newerAfter] = await db
			.select()
			.from(inventoryLots)
			.where(eq(inventoryLots.id, newerLot.id));
		const [productAfter] = await db.select().from(products).where(eq(products.id, product.id));

		// FIFO: 1 from the older lot, 2 from the newer one.
		expect(olderAfter.quantityAvailable).toBe(0);
		expect(newerAfter.quantityAvailable).toBe(3);
		expect(productAfter.stock).toBe(3);

		const movements = await db
			.select()
			.from(inventoryMovements)
			.where(
				and(
					eq(inventoryMovements.referenceId, sale.id),
					eq(inventoryMovements.referenceType, MovementReferenceType.SALE)
				)
			);
		expect(
			movements.filter((m) => m.movementType === InventoryMovementType.CANCEL_REVERT)
		).toHaveLength(1);
		// 1 from the original sale + 2 FIFO allocations of the edit.
		expect(movements.filter((m) => m.movementType === InventoryMovementType.SALE_OUT)).toHaveLength(
			3
		);

		const activeItems = await db
			.select()
			.from(saleItems)
			.where(and(eq(saleItems.saleId, sale.id), isNull(saleItems.deletedAt)));
		expect(activeItems).toHaveLength(1);
		expect(activeItems[0].quantity).toBe(3);
		expect(activeItems[0].snapshotLotsCount).toBe(2);
	});

	it('gives the stock back when the item switches to another product', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const supplier = await createSupplier();
		const material = await createMaterial();
		const productA = await createProduct({
			supplierId: supplier.id,
			materialId: material.id,
			stock: 4
		});
		const productB = await createProduct({
			supplierId: supplier.id,
			materialId: material.id,
			stock: 5
		});
		const purchaseOrder = await createPurchaseOrder({
			supplierId: supplier.id,
			createdById: admin.id
		});
		const poItemA = await createPurchaseOrderItem({
			purchaseOrderId: purchaseOrder.id,
			productId: productA.id
		});
		const poItemB = await createPurchaseOrderItem({
			purchaseOrderId: purchaseOrder.id,
			productId: productB.id
		});
		const lotA = await createInventoryLot({
			purchaseOrderItemId: poItemA.id,
			productId: productA.id,
			quantityInitial: 5,
			quantityAvailable: 4,
			createdAt: '2026-01-01T00:00:00.000Z'
		});
		const lotB = await createInventoryLot({
			purchaseOrderItemId: poItemB.id,
			productId: productB.id,
			quantityInitial: 5,
			quantityAvailable: 5,
			createdAt: '2026-01-02T00:00:00.000Z'
		});

		const sale = await createSale({ sellerId: admin.id, subtotal: 20, total: 20 });
		await createSaleItem({
			saleId: sale.id,
			productId: productA.id,
			lotId: lotA.id,
			quantity: 1,
			unitPrice: 20
		});
		await createInventoryMovement({
			movementType: InventoryMovementType.SALE_OUT,
			lotId: lotA.id,
			productId: productA.id,
			quantityDelta: -1,
			quantityBefore: 5,
			quantityAfter: 4,
			referenceType: MovementReferenceType.SALE,
			referenceId: sale.id,
			createdById: admin.id
		});

		const result = await updateSaleCore(
			{ id: sale.id, reason: 'otro producto', items: [productItem(productB.id, 2)] },
			ctx(admin.id)
		);

		expect(result.success).toBe(true);

		const [lotAAfter] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotA.id));
		const [lotBAfter] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lotB.id));
		const [productAAfter] = await db.select().from(products).where(eq(products.id, productA.id));
		const [productBAfter] = await db.select().from(products).where(eq(products.id, productB.id));

		expect(lotAAfter.quantityAvailable).toBe(5);
		expect(productAAfter.stock).toBe(5);
		expect(lotBAfter.quantityAvailable).toBe(3);
		expect(productBAfter.stock).toBe(3);
	});

	it('rolls the whole edit back when the new quantity exceeds stock', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const supplier = await createSupplier();
		const material = await createMaterial();
		const product = await createProduct({
			supplierId: supplier.id,
			materialId: material.id,
			stock: 4
		});
		const purchaseOrder = await createPurchaseOrder({
			supplierId: supplier.id,
			createdById: admin.id
		});
		const poItem = await createPurchaseOrderItem({
			purchaseOrderId: purchaseOrder.id,
			productId: product.id
		});
		const lot = await createInventoryLot({
			purchaseOrderItemId: poItem.id,
			productId: product.id,
			quantityInitial: 5,
			quantityAvailable: 4,
			createdAt: '2026-01-01T00:00:00.000Z'
		});

		const sale = await createSale({ sellerId: admin.id, subtotal: 20, total: 20 });
		await createSaleItem({
			saleId: sale.id,
			productId: product.id,
			lotId: lot.id,
			quantity: 1,
			unitPrice: 20
		});
		await createInventoryMovement({
			movementType: InventoryMovementType.SALE_OUT,
			lotId: lot.id,
			productId: product.id,
			quantityDelta: -1,
			quantityBefore: 5,
			quantityAfter: 4,
			referenceType: MovementReferenceType.SALE,
			referenceId: sale.id,
			createdById: admin.id
		});

		await expect(
			updateSaleCore(
				{ id: sale.id, reason: 'cantidad excesiva', items: [productItem(product.id, 50)] },
				ctx(admin.id)
			)
		).rejects.toThrow('Stock insuficiente');

		// Transaction rolled back: nothing was reverted or replaced.
		const [lotAfter] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lot.id));
		const [productAfter] = await db.select().from(products).where(eq(products.id, product.id));
		expect(lotAfter.quantityAvailable).toBe(4);
		expect(productAfter.stock).toBe(4);

		const activeItems = await db
			.select()
			.from(saleItems)
			.where(and(eq(saleItems.saleId, sale.id), isNull(saleItems.deletedAt)));
		expect(activeItems).toHaveLength(1);
		expect(activeItems[0].quantity).toBe(1);
	});
});
