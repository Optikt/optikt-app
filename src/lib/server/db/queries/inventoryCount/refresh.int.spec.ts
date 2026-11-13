/**
 * Integration tests — «Refrescar stock»: re-sincroniza `system_stock` con el
 * stock vivo durante una sesión OPEN.
 *
 * Invariante central: solo cambian las líneas cuyo stock difiere del snapshot;
 * las que no cambian conservan su conteo. Las que cambian pierden todo lo
 * derivado (contaban contra la referencia vieja).
 *
 * Requiere DATABASE_URL (Testcontainers) — igual que el resto de suites .int.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';
import {
	inventoryCountLines,
	inventoryCountSessions,
	lensCatalogItems,
	lensMaterials,
	products
} from '$lib/server/db/schema';
import { resetDb } from '$lib/testing/integration/db';
import {
	createBrand,
	createInventoryCountLine,
	createInventoryCountSession,
	createInventoryLot,
	createMaterial,
	createProduct,
	createSupplier,
	createUser
} from '$lib/testing/integration/factories';
import { AdjustmentReason, LensType, UserRole } from '$lib/shared/enums';
import { upsertCountLine } from './lines';
import { requestCountLineAdjustment } from './adjustments';
import { previewSessionStockRefresh, refreshSessionStock } from './refresh';

async function setProductStock(productId: string, stock: number): Promise<void> {
	await db.update(products).set({ stock }).where(eq(products.id, productId));
}

async function lineById(lineId: number) {
	const [row] = await db
		.select()
		.from(inventoryCountLines)
		.where(eq(inventoryCountLines.id, lineId))
		.limit(1);
	return row;
}

async function productFixture(stock = 5) {
	const supplier = await createSupplier();
	const brand = await createBrand();
	const material = await createMaterial();
	const product = await createProduct({
		supplierId: supplier.id,
		materialId: material.id,
		brandId: brand.id,
		stock
	});
	return { product };
}

describe('refreshSessionStock', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('actualiza solo las líneas cuyo stock cambió y limpia ahí el conteo', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product: unchanged } = await productFixture(5);
		const { product: sold } = await productFixture(5);
		const { product: returned } = await productFixture(5);

		const session = await createInventoryCountSession({ openedById: admin.id });
		const lineUnchanged = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: unchanged.id,
			systemStock: 5,
			countedStock: 5,
			difference: 0
		});
		const lineSold = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: sold.id,
			systemStock: 5,
			countedStock: 5,
			difference: 0
		});
		const lineReturned = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: returned.id,
			systemStock: 5,
			countedStock: 5,
			difference: 0
		});

		// Fuera de la sesión: una venta se editó (−2) y una devolución repuso (+2).
		await setProductStock(sold.id, 3);
		await setProductStock(returned.id, 7);

		const preview = await previewSessionStockRefresh(session.id);
		expect(preview).toEqual({
			totalLines: 3,
			updatedLines: 2,
			clearedCounts: 2,
			untouchedLines: 1
		});

		const result = await refreshSessionStock(session.id);
		expect(result).toEqual(preview);

		// La línea intacta conserva su conteo…
		const untouched = await lineById(lineUnchanged.id);
		expect(untouched.systemStock).toBe(5);
		expect(untouched.countedStock).toBe(5);

		// …las que cambiaron reciben el stock nuevo y pierden el conteo.
		const afterSold = await lineById(lineSold.id);
		expect(afterSold.systemStock).toBe(3);
		expect(afterSold.countedStock).toBeNull();
		expect(afterSold.difference).toBeNull();

		const afterReturned = await lineById(lineReturned.id);
		expect(afterReturned.systemStock).toBe(7);
		expect(afterReturned.countedStock).toBeNull();
	});

	it('limpia también recuento y solicitud de ajuste de la línea que cambió', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture(8);
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 8,
			countedStock: 6,
			difference: -2
		});
		await upsertCountLine({ lineId: line.id, countedStock: 6, userId: admin.id });
		// El pedido de ajuste valida lotes FIFO antes de escribir.
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 8,
			quantityAvailable: 8,
			unitPurchasePrice: 10,
			bcvRateAtPurchase: 1
		});
		await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});

		await setProductStock(product.id, 9);
		await refreshSessionStock(session.id);

		const after = await lineById(line.id);
		expect(after.systemStock).toBe(9);
		expect(after.countedStock).toBeNull();
		expect(after.recountedStock).toBeNull();
		expect(after.adjustmentRequestedAt).toBeNull();
		expect(after.adjustmentReason).toBeNull();
		expect(after.adjustmentRequestedBy).toBeNull();
	});

	it('nada cambia → updates vacíos y los conteos siguen intactos', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture(4);
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 4,
			countedStock: 4,
			difference: 0
		});

		expect(await previewSessionStockRefresh(session.id)).toEqual({
			totalLines: 1,
			updatedLines: 0,
			clearedCounts: 0,
			untouchedLines: 1
		});

		await refreshSessionStock(session.id);

		const after = await lineById(line.id);
		expect(after.systemStock).toBe(4);
		expect(after.countedStock).toBe(4);
	});

	it('lee el stock vivo de los lentes (lens_catalog_items.stock)', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const supplier = await createSupplier();
		const [lensMaterial] = await db
			.insert(lensMaterials)
			.values({ name: `Mat ${crypto.randomUUID()}`, code: `LM-${crypto.randomUUID()}` })
			.returning();
		const [lens] = await db
			.insert(lensCatalogItems)
			.values({
				supplierId: supplier.id,
				name: `Lente ${crypto.randomUUID()}`,
				type: LensType.MONOFOCAL,
				materialId: lensMaterial.id,
				inventoryMode: 'STOCK',
				basePrice: 0,
				stock: 3
			})
			.returning();

		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'LENS',
			lensCatalogItemId: lens.id,
			productId: null,
			systemStock: 3,
			countedStock: 3,
			difference: 0
		});

		await db.update(lensCatalogItems).set({ stock: 1 }).where(eq(lensCatalogItems.id, lens.id));
		await refreshSessionStock(session.id);

		const after = await lineById(line.id);
		expect(after.systemStock).toBe(1);
		expect(after.countedStock).toBeNull();
	});

	it('falla si la sesión no está abierta', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture(5);
		const session = await createInventoryCountSession({ openedById: admin.id });
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 5,
			countedStock: 5,
			difference: 0
		});

		await db
			.update(inventoryCountSessions)
			.set({ status: 'APPLIED' })
			.where(eq(inventoryCountSessions.id, session.id));

		await expect(refreshSessionStock(session.id)).rejects.toThrow('La sesión ya no está abierta');
		await expect(previewSessionStockRefresh(session.id)).rejects.toThrow(
			'La sesión ya no está abierta'
		);
	});

	it('una línea limpiada no admite solicitud de ajuste (nada queda huérfano)', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture(5);
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 5,
			countedStock: 6,
			difference: 1
		});
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 5,
			quantityAvailable: 5,
			unitPurchasePrice: 10,
			bcvRateAtPurchase: 1
		});

		await setProductStock(product.id, 4);
		await refreshSessionStock(session.id);

		// El refresh limpió el conteo → no hay diff que ajustar.
		await expect(
			requestCountLineAdjustment({
				lineId: line.id,
				reason: AdjustmentReason.PHYSICAL_COUNT,
				reasonText: null,
				userId: admin.id
			})
		).rejects.toThrow('La línea todavía no está contada');
		expect((await lineById(line.id)).adjustmentRequestedAt).toBeNull();
	});

	it('una línea que NO cambia conserva su solicitud de ajuste y su diferencia exactas', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product: kept } = await productFixture(5);
		const { product: changed } = await productFixture(5);

		const session = await createInventoryCountSession({ openedById: admin.id });
		const lineKept = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: kept.id,
			systemStock: 5,
			countedStock: 6,
			difference: 1
		});
		const lineChanged = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: changed.id,
			systemStock: 5,
			countedStock: 5,
			difference: 0
		});

		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: kept.id,
			lensCatalogItemId: null,
			quantityInitial: 5,
			quantityAvailable: 5,
			unitPurchasePrice: 20,
			bcvRateAtPurchase: 1
		});
		await requestCountLineAdjustment({
			lineId: lineKept.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: 'revisar',
			userId: admin.id
		});
		const before = await lineById(lineKept.id);

		await setProductStock(changed.id, 3);
		await refreshSessionStock(session.id);

		// Intacta: system, diff, solicitud y motivo tal cual estaban.
		const after = await lineById(lineKept.id);
		expect(after.systemStock).toBe(5);
		expect(after.countedStock).toBe(6);
		expect(after.difference).toBe(1);
		expect(after.adjustmentRequestedAt).toBe(before.adjustmentRequestedAt);
		expect(after.adjustmentReason).toBe(before.adjustmentReason);
		expect(after.adjustmentReasonText).toBe(before.adjustmentReasonText);
		expect(after.adjustmentRequestedBy).toBe(before.adjustmentRequestedBy);

		// La que cambió sí se limpia.
		const changedAfter = await lineById(lineChanged.id);
		expect(changedAfter.systemStock).toBe(3);
		expect(changedAfter.countedStock).toBeNull();
	});
});
