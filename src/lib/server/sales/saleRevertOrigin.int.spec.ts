import { beforeEach, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { updateSaleCore } from './updateSale';
import { cancelSaleCore } from './cancelSale';
import { db } from '$lib/server/db';
import { inventoryMovements } from '$lib/server/db/schema';
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
	DiscountType,
	InventoryMovementType,
	MovementReferenceType,
	RefundStatus,
	SaleItemType,
	UserRole
} from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.ADMIN, ipAddress: '127.0.0.1', userAgent: null };
}

async function seedSaleWithConsumption() {
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
	const customer = await createCustomer();
	const sale = await createSale({
		customerId: customer.id,
		sellerId: admin.id,
		subtotal: 20,
		total: 20
	});
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
	return { admin, product, sale };
}

async function saleMovements(saleId: string) {
	return db
		.select()
		.from(inventoryMovements)
		.where(
			and(
				eq(inventoryMovements.referenceId, saleId),
				eq(inventoryMovements.referenceType, MovementReferenceType.SALE)
			)
		);
}

describe('sale revert origin — EDIT_REVERT vs CANCEL_REVERT', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('an edit writes EDIT_REVERT with the edit reason in notes', async () => {
		const { admin, product, sale } = await seedSaleWithConsumption();

		const result = await updateSaleCore(
			{
				id: sale.id,
				reason: 'cambio de montura',
				items: [
					{
						itemType: SaleItemType.PRODUCT,
						productId: product.id,
						quantity: 1,
						unitPrice: 20,
						discount: 0,
						discountType: DiscountType.FIXED,
						snapshotIsTaxable: false
					}
				]
			},
			ctx(admin.id)
		);
		expect(result.success).toBe(true);

		const movements = await saleMovements(sale.id);
		const edits = movements.filter((m) => m.movementType === InventoryMovementType.EDIT_REVERT);
		expect(edits).toHaveLength(1);
		expect(edits[0].notes).toContain('cambio de montura');
		expect(
			movements.filter((m) => m.movementType === InventoryMovementType.CANCEL_REVERT)
		).toHaveLength(0);
	});

	it('a cancellation still writes CANCEL_REVERT', async () => {
		const { admin, sale } = await seedSaleWithConsumption();

		const result = await cancelSaleCore(
			{
				id: sale.id,
				reason: 'Motivo de cancelación de prueba',
				refundStatus: RefundStatus.RETAINED
			},
			ctx(admin.id)
		);
		expect(result).toEqual({ success: true });

		const movements = await saleMovements(sale.id);
		expect(
			movements.filter((m) => m.movementType === InventoryMovementType.CANCEL_REVERT)
		).toHaveLength(1);
		expect(
			movements.filter((m) => m.movementType === InventoryMovementType.EDIT_REVERT)
		).toHaveLength(0);
	});
});
