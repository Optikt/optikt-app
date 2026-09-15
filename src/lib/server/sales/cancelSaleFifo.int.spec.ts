import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { cancelSaleCore } from './cancelSale';
import { db } from '$lib/server/db';
import { inventoryLots, products } from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import {
	createCustomer,
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
	InventoryMovementType,
	MovementReferenceType,
	RefundStatus,
	UserRole
} from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.ADMIN, ipAddress: '127.0.0.1', userAgent: null };
}

describe('cancelSaleCore — FIFO reversal', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('restores the consumed lot and the cached product stock', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const supplier = await createSupplier();
		const material = await createMaterial();
		const product = await createProduct({
			supplierId: supplier.id,
			materialId: material.id,
			stock: 8
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
			quantityInitial: 10,
			quantityAvailable: 8
		});
		const customer = await createCustomer();
		const sale = await createSale({
			customerId: customer.id,
			sellerId: admin.id,
			subtotal: 100,
			total: 100
		});
		await createSaleItem({
			saleId: sale.id,
			productId: product.id,
			lotId: lot.id,
			quantity: 2,
			unitPrice: 20
		});
		await createInventoryMovement({
			movementType: InventoryMovementType.SALE_OUT,
			lotId: lot.id,
			productId: product.id,
			quantityDelta: -2,
			quantityBefore: 10,
			quantityAfter: 8,
			referenceType: MovementReferenceType.SALE,
			referenceId: sale.id,
			createdById: admin.id
		});

		const result = await cancelSaleCore(
			{
				id: sale.id,
				reason: 'Motivo de cancelación de prueba',
				refundStatus: RefundStatus.RETAINED
			},
			ctx(admin.id)
		);

		expect(result).toEqual({ success: true });
		const [lotAfter] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lot.id));
		const [productAfter] = await db.select().from(products).where(eq(products.id, product.id));
		expect(lotAfter.quantityAvailable).toBe(10);
		expect(productAfter.stock).toBe(10);
	});
});
