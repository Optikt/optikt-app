import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createManualAdjustmentCore } from './createManualAdjustment';
import { db } from '$lib/server/db';
import { inventoryLots, products } from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import {
	createInventoryLot,
	createMaterial,
	createProduct,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { AdjustmentReason, InventoryMovementType, UserRole } from '$lib/shared/enums';
import type { ActionContext } from '$lib/server/actionContext';
import type { ManualAdjustmentInput } from '$lib/schemas/inventory';

function ctx(userId: string): ActionContext {
	return { userId, role: UserRole.ADMIN, ipAddress: '127.0.0.1', userAgent: null };
}

async function seedLot(stock = 10, lotQuantity = 10) {
	const supplier = await createSupplier();
	const material = await createMaterial();
	const product = await createProduct({
		supplierId: supplier.id,
		materialId: material.id,
		stock
	});
	const lot = await createInventoryLot({
		productId: product.id,
		quantityInitial: lotQuantity,
		quantityAvailable: lotQuantity,
		unitPurchasePrice: 5
	});
	return { product, lot };
}

describe('createManualAdjustmentCore', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('adjusts stock out and updates lot + cached product stock', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product, lot } = await seedLot();
		const data: ManualAdjustmentInput = {
			lotId: lot.id,
			adjustmentType: InventoryMovementType.ADJUSTMENT_OUT,
			quantity: 3,
			reason: AdjustmentReason.DAMAGE,
			notes: 'ajuste de prueba por daño'
		};

		const result = await createManualAdjustmentCore(data, ctx(admin.id));

		expect(result.success).toBe(true);
		const [lotAfter] = await db.select().from(inventoryLots).where(eq(inventoryLots.id, lot.id));
		const [productAfter] = await db.select().from(products).where(eq(products.id, product.id));
		expect(lotAfter.quantityAvailable).toBe(7);
		expect(productAfter.stock).toBe(7);
	});

	it('adjusts stock in', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product, lot } = await seedLot();

		const result = await createManualAdjustmentCore(
			{
				lotId: lot.id,
				adjustmentType: InventoryMovementType.ADJUSTMENT_IN,
				quantity: 5,
				reason: AdjustmentReason.PHYSICAL_COUNT,
				notes: 'ajuste por conteo físico'
			},
			ctx(admin.id)
		);

		expect(result.success).toBe(true);
		const [productAfter] = await db.select().from(products).where(eq(products.id, product.id));
		expect(productAfter.stock).toBe(15);
	});

	it('rejects an outflow larger than the available stock', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { lot } = await seedLot();

		const result = await createManualAdjustmentCore(
			{
				lotId: lot.id,
				adjustmentType: InventoryMovementType.ADJUSTMENT_OUT,
				quantity: 11,
				reason: AdjustmentReason.DAMAGE,
				notes: 'salida imposible'
			},
			ctx(admin.id)
		);

		expect(result).toEqual({
			success: false,
			error: 'Stock insuficiente. Disponible: 10, solicitado: 11'
		});
	});

	it('returns not found for an unknown lot', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });

		const result = await createManualAdjustmentCore(
			{
				lotId: crypto.randomUUID(),
				adjustmentType: InventoryMovementType.ADJUSTMENT_IN,
				quantity: 1,
				reason: AdjustmentReason.PHYSICAL_COUNT,
				notes: 'lote inexistente'
			},
			ctx(admin.id)
		);

		expect(result).toEqual({ success: false, error: 'Lote no encontrado' });
	});
});
