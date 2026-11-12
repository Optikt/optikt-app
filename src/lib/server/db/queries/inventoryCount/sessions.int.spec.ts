/**
 * Integration tests for the Conteo Físico redesign:
 * nueva regla de cierre, responsables y acceso, ajuste vinculado a la línea,
 * upsertCountLine ligero con reset de derivados y alcance estructurado.
 *
 * Requiere DATABASE_URL (Testcontainers) — igual que el resto de suites .int.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AdjustmentReason, InventoryMovementType, LensType } from '$lib/shared/enums';
import { applySession, cancelSession, createSession, getSessionRow } from './sessions';
import { recountCountLine, upsertCountLine, getSessionLines } from './lines';
import { buildLineCostMap } from './costs';
import {
	clearLineAdjustmentRequest,
	executeCountLineAdjustment,
	requestAdjustmentsBatch,
	requestCountLineAdjustment
} from './adjustments';
import { syncSessionResponsibles, listSessionResponsibles } from './responsibles';
import { resetDb } from '$lib/testing/integration/db';
import { getNextFifoCost } from '$lib/server/db/queries/inventoryLots';
import { and, count, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	inventoryLots,
	inventoryMovements,
	lensCatalogItems,
	lensMaterials,
	products
} from '$lib/server/db/schema';

async function productStock(productId: string): Promise<number> {
	const [row] = await db
		.select({ stock: products.stock })
		.from(products)
		.where(eq(products.id, productId));
	return row?.stock ?? 0;
}

async function movementCount(productId: string): Promise<number> {
	const [row] = await db
		.select({ n: count() })
		.from(inventoryMovements)
		.where(eq(inventoryMovements.productId, productId));
	return Number(row?.n ?? 0);
}
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
import { UserRole } from '$lib/shared/enums';

async function productFixture() {
	const supplier = await createSupplier();
	const brand = await createBrand();
	const material = await createMaterial();
	const product = await createProduct({
		supplierId: supplier.id,
		materialId: material.id,
		brandId: brand.id,
		stock: 5
	});
	return { supplier, brand, material, product };
}

describe('applySession (nueva regla de cierre)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('cierra con stock 0 sin confirmar y no lo verifica', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		const session = await createInventoryCountSession({ openedById: admin.id });
		await createInventoryCountLine({
			sessionId: session.id,
			productId: product.id,
			itemType: 'PRODUCT',
			systemStock: 5,
			countedStock: 5,
			difference: 0,
			countedById: admin.id
		});
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			systemStock: 0,
			countedStock: null,
			difference: null
		});

		const result = await applySession(session.id, admin.id);
		expect(result.status).toBe('APPLIED');
		expect(result.totalItemsCounted).toBe(1);
		expect(result.totalMatches).toBe(1);
	});

	it('bloquea con pendientes de conteo (stock > 0)', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const session = await createInventoryCountSession({ openedById: admin.id });
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			systemStock: 3,
			countedStock: null,
			difference: null
		});

		await expect(applySession(session.id, admin.id)).rejects.toThrow('ítem(s) con stock');
	});

	it('bloquea diferencias sobre el umbral sin recuento', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const session = await createInventoryCountSession({ openedById: admin.id });
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			systemStock: 2,
			countedStock: 9,
			difference: 7
		});

		await expect(applySession(session.id, admin.id)).rejects.toThrow('recontarse');
	});

	it('fija lastCountedAt solo en ítems verificados', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		const session = await createInventoryCountSession({ openedById: admin.id });
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 5,
			countedStock: 5,
			difference: 0,
			countedById: admin.id
		});

		const result = await applySession(session.id, admin.id);

		const refreshed = await import('$lib/server/db/queries/products').then((module) =>
			module.findProductById(product.id)
		);
		expect(refreshed?.lastCountedAt).not.toBeNull();
		expect(result.coverageAfter).not.toBeNull();
	});

	it('rechaza a un SELLER', async () => {
		const seller = await createUser({ role: UserRole.SELLER });
		const session = await createInventoryCountSession();
		await expect(applySession(session.id, seller.id)).rejects.toThrow('Solo ADMIN o MANAGER');
	});

	it('rechaza sesión no abierta', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const session = await createInventoryCountSession({
			openedById: admin.id,
			status: 'APPLIED'
		});
		await expect(applySession(session.id, admin.id)).rejects.toThrow('ya no está abierta');
	});
});

describe('participantes y responsables', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('alta/baja lógica conserva lo contado', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const seller = await createUser({ role: UserRole.SELLER });

		await productFixture();

		const detail = await createSession({
			scopeKind: 'ALL',
			scopeDim: 'ALL',
			scopeValues: [],
			scopeN: null,
			notes: null,
			openedById: admin.id,
			responsibles: [{ userId: seller.id, displayName: seller.fullName, isExternal: false }]
		});

		const active = await listSessionResponsibles(detail.id);
		expect(active.map((entry) => entry.userId)).toContain(admin.id);
		expect(active.map((entry) => entry.userId)).toContain(seller.id);

		await syncSessionResponsibles(
			detail.id,
			[{ userId: admin.id, isExternal: false, displayName: admin.fullName }],
			admin.id
		);
		const after = await listSessionResponsibles(detail.id);
		expect(after.map((entry) => entry.userId)).toContain(admin.id);
		expect(after.map((entry) => entry.userId)).not.toContain(seller.id);

		await cancelSession(detail.id, admin.id, 'Sesión de prueba cancelada');
	});
});

describe('ajuste vinculado a la línea', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('una solicitud no toca stock hasta cerrar; al cerrar crea el movement', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10,
			unitPurchasePrice: 90,
			bcvRateAtPurchase: 1
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 8,
			countedStock: 9,
			difference: 1
		});

		const movementsBefore = await movementCount(product.id);
		const stockBefore = await productStock(product.id);

		const requested = await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});
		// Solo se marca: ni movimientos ni stock cambian hasta cerrar.
		expect(await movementCount(product.id)).toBe(movementsBefore);
		expect(await productStock(product.id)).toBe(stockBefore);
		expect(requested.adjustmentMovementId).toBeNull();
		expect(requested.adjustmentRequestedAt).not.toBeNull();
		expect(requested.adjustmentReason).toBe(AdjustmentReason.PHYSICAL_COUNT);

		// Lo pide adminA y lo cierra adminB: completedById = quien cierra.
		const closer = await createUser({ role: UserRole.ADMIN });
		await applySession(session.id, closer.id);

		const rows = await getSessionLines(session.id, 'ALL');
		const row = rows.find((candidate) => candidate.id === line.id);
		expect(row?.adjustmentMovementId).not.toBeNull();
		expect(row?.adjustmentCompleted).toBe(true);
		expect(row?.adjustmentCompletedById).toBe(closer.id);

		// Movimiento real: +1 ADJUSTMENT_IN, notas y stock del producto +1.
		expect(await movementCount(product.id)).toBe(movementsBefore + 1);
		expect(await productStock(product.id)).toBe(stockBefore + 1);
		const [movement] = await db
			.select()
			.from(inventoryMovements)
			.where(
				and(
					eq(inventoryMovements.productId, product.id),
					eq(inventoryMovements.movementType, InventoryMovementType.ADJUSTMENT_IN)
				)
			)
			.limit(1);
		expect(movement?.quantityDelta).toBe(1);
		expect(movement?.quantityAfter).toBe((movement?.quantityBefore ?? 0) + 1);
		expect(movement?.notes).toBe('Conteo físico: Conteo físico');
	});

	it('«Ajustar todo» marca solo diferencias bajo el umbral', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product: productA } = await productFixture();
		const { product: productB } = await productFixture();
		for (const product of [productA, productB]) {
			await createInventoryLot({
				itemType: 'PRODUCT',
				productId: product.id,
				lensCatalogItemId: null,
				quantityInitial: 10,
				quantityAvailable: 10
			});
		}
		const session = await createInventoryCountSession({ openedById: admin.id });
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: productA.id,
			systemStock: 5,
			countedStock: 6,
			difference: 1
		});
		// Sobre el umbral (≥ 2): fuera del lote
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: productB.id,
			systemStock: 5,
			countedStock: 9,
			difference: 4
		});

		const applied = await requestAdjustmentsBatch(
			session.id,
			AdjustmentReason.PHYSICAL_COUNT,
			null,
			admin.id
		);
		expect(applied).toBe(1);

		const rows = await getSessionLines(session.id, 'ALL');
		const adjusted = rows.find((row) => row.productId === productA.id);
		const skipped = rows.find((row) => row.productId === productB.id);
		expect(adjusted?.adjustmentRequestedAt).not.toBeNull();
		expect(adjusted?.adjustmentMovementId).toBeNull();
		expect(skipped?.adjustmentRequestedAt).toBeNull();
		expect(skipped?.adjustmentMovementId).toBeNull();
	});

	it('falla cuando el lote activo no tiene stock suficiente (salida)', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 3,
			quantityAvailable: 1
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 5,
			countedStock: 1,
			difference: -4
		});

		await expect(
			requestCountLineAdjustment({
				lineId: line.id,
				reason: AdjustmentReason.PHYSICAL_COUNT,
				reasonText: null,
				userId: admin.id
			})
		).rejects.toThrow('lote');
	});

	it('cancelar la sesión descarta lo solicitado: no se crea ningún movimiento', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10,
			unitPurchasePrice: 90,
			bcvRateAtPurchase: 1
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 8,
			countedStock: 9,
			difference: 1
		});

		const before = await movementCount(product.id);
		await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});
		await cancelSession(session.id, admin.id, 'cambio de planes');

		expect(await movementCount(product.id)).toBe(before);
		const rows = await getSessionLines(session.id, 'ALL');
		expect(rows.find((candidate) => candidate.id === line.id)?.adjustmentMovementId).toBeNull();
	});

	it('quitar la solicitud deja la línea sin ajuste al cerrar', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10,
			unitPurchasePrice: 90,
			bcvRateAtPurchase: 1
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 8,
			countedStock: 9,
			difference: 1
		});

		await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});
		await clearLineAdjustmentRequest(line.id);
		const afterClear = await getSessionLines(session.id, 'ALL');
		expect(
			afterClear.find((candidate) => candidate.id === line.id)?.adjustmentRequestedAt
		).toBeNull();

		await applySession(session.id, admin.id);
		const rows = await getSessionLines(session.id, 'ALL');
		expect(rows.find((candidate) => candidate.id === line.id)?.adjustmentMovementId).toBeNull();
	});

	it('si el lote no alcanza al cerrar: revierte todo y explica cómo salir', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10,
			unitPurchasePrice: 90,
			bcvRateAtPurchase: 1
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 9,
			countedStock: 8,
			difference: -1
		});
		await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});

		// El stock disponible cae entre la solicitud y el cierre.
		await db
			.update(inventoryLots)
			.set({ quantityAvailable: 0 })
			.where(eq(inventoryLots.productId, product.id));
		const movementsBefore = await movementCount(product.id);

		await expect(applySession(session.id, admin.id)).rejects.toThrow('Quita la solicitud');
		expect((await getSessionRow(session.id))?.status).toBe('OPEN');
		expect(await movementCount(product.id)).toBe(movementsBefore);

		// Quitar la solicitud destraba el cierre (la línea queda sin ajustar).
		await clearLineAdjustmentRequest(line.id);
		await applySession(session.id, admin.id);
		expect((await getSessionRow(session.id))?.status).toBe('APPLIED');
		const rows = await getSessionLines(session.id, 'ALL');
		expect(rows.find((candidate) => candidate.id === line.id)?.adjustmentMovementId).toBeNull();
	});

	it('un recuento que cambia la diferencia descarta la solicitud', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 20,
			countedStock: 19,
			difference: -1
		});

		await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});
		const recounted = await recountCountLine({
			lineId: line.id,
			recountedStock: 15,
			userId: admin.id
		});
		expect(recounted.adjustmentRequestedAt).toBeNull();
		expect(recounted.adjustmentReason).toBeNull();

		await applySession(session.id, admin.id);
		const rows = await getSessionLines(session.id, 'ALL');
		expect(rows.find((candidate) => candidate.id === line.id)?.adjustmentMovementId).toBeNull();
	});

	it('guard de ejecución: una solicitud ya quitada no crea movimiento (carrera)', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 8,
			countedStock: 9,
			difference: 1
		});
		const movementsBefore = await movementCount(product.id);

		await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});
		// Copia «stale» de la línea (la que leería un cierre concurrente)…
		const stale = (await getSessionLines(session.id, 'ALL')).find(
			(candidate) => candidate.id === line.id
		);
		expect(stale?.adjustmentRequestedAt).not.toBeNull();
		// …mientras otra transacción quita la solicitud.
		await clearLineAdjustmentRequest(line.id);

		if (!stale) throw new Error('línea stale no encontrada');
		await expect(executeCountLineAdjustment(stale, admin.id, db)).rejects.toThrow(
			'cambió durante el cierre'
		);
		expect(await movementCount(product.id)).toBe(movementsBefore);
	});
});

describe('upsertCountLine ligero + reset de derivados', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('devuelve solo la línea y limpia recuento/ajuste/solicitud al cambiar el conteo', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 5,
			countedStock: 5,
			difference: 0,
			countedById: admin.id
		});

		const recounted = await recountCountLine({
			lineId: line.id,
			recountedStock: 6,
			userId: admin.id
		});
		expect(recounted.recountedStock).toBe(6);

		const requested = await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});
		expect(requested.adjustmentRequestedAt).not.toBeNull();

		const changed = await upsertCountLine({ lineId: line.id, countedStock: 7, userId: admin.id });
		expect(changed.countedStock).toBe(7);
		expect(changed.recountedStock).toBeNull();
		expect(changed.difference).toBe(2);
		// Cambiar el conteo descarta la solicitud de ajuste.
		expect(changed.adjustmentRequestedAt).toBeNull();
		expect(changed.adjustmentReason).toBeNull();
	});
});

describe('createSession con alcance estructurado', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('crea snapshot por marca y rechaza segunda OPEN', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { brand, product } = await productFixture();

		const detail = await createSession({
			scopeKind: 'BRAND',
			scopeDim: 'BRAND',
			scopeValues: [brand.id],
			scopeN: null,
			notes: null,
			openedById: admin.id,
			responsibles: []
		});
		expect(detail.lines.length).toBeGreaterThanOrEqual(1);
		expect(detail.lines.every((line) => line.brandName === brand.name)).toBe(true);
		expect(detail.scopeLabel).toContain(brand.name);

		void product;
		await expect(
			createSession({
				scopeKind: 'ALL',
				scopeDim: 'ALL',
				scopeValues: [],
				scopeN: null,
				notes: null,
				openedById: admin.id,
				responsibles: []
			})
		).rejects.toThrow('Ya existe una sesión de conteo abierta');
	});
});

describe('costo FIFO congelado (informe estable)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('al cerrar persiste fifo_cost_usd aunque el ajuste drene el lote', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 1,
			quantityAvailable: 1,
			unitPurchasePrice: 90,
			bcvRateAtPurchase: 1
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 1,
			countedStock: 0,
			difference: -1
		});
		await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});

		await applySession(session.id, admin.id);

		// El ajuste drenó el lote…
		const [lot] = await db
			.select({ qty: inventoryLots.quantityAvailable, active: inventoryLots.isActive })
			.from(inventoryLots)
			.where(eq(inventoryLots.productId, product.id));
		expect(lot.qty).toBe(0);
		expect(lot.active).toBe(false);

		// …pero el costo quedó congelado y el mapa lo prefiere al FIFO vivo.
		const rows = await getSessionLines(session.id, 'ALL');
		const closed = rows.find((candidate) => candidate.id === line.id);
		expect(closed?.fifoCostUsd).toBe(90);
		const map = await buildLineCostMap(rows);
		expect(map.get(line.id)).toBe(90);
	});

	it('cancelar congela los costos; las líneas sin diferencia quedan en null', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product: productA } = await productFixture();
		const { product: productB } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: productA.id,
			lensCatalogItemId: null,
			quantityInitial: 4,
			quantityAvailable: 4,
			unitPurchasePrice: 55,
			bcvRateAtPurchase: 1
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const withDiff = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: productA.id,
			systemStock: 4,
			countedStock: 3,
			difference: -1
		});
		const equal = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: productB.id,
			systemStock: 5,
			countedStock: 5,
			difference: 0
		});

		await cancelSession(session.id, admin.id, 'sin ajustar por ahora');

		const rows = await getSessionLines(session.id, 'ALL');
		expect(rows.find((candidate) => candidate.id === withDiff.id)?.fifoCostUsd).toBe(55);
		expect(rows.find((candidate) => candidate.id === equal.id)?.fifoCostUsd).toBeNull();
		const map = await buildLineCostMap(rows);
		expect(map.get(withDiff.id)).toBe(55);
	});
});

describe('costo congelado — multi-lote, entrada y lentes', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('multi-lote (A $5 primero, B $3): guarda $5 aunque A se drene; un lote C $99 posterior tampoco lo cambia', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 1,
			quantityAvailable: 1,
			unitPurchasePrice: 5,
			bcvRateAtPurchase: 1
		});
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 5,
			quantityAvailable: 5,
			unitPurchasePrice: 3,
			bcvRateAtPurchase: 1
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 1,
			countedStock: 0,
			difference: -1
		});
		await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});

		await applySession(session.id, admin.id);

		// El ajuste drenó A: el FIFO vivo ya es B ($3)…
		expect(await getNextFifoCost(product.id)).toBe(3);
		// …y un lote nuevo caro posterior tampoco debe tocar el informe.
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10,
			unitPurchasePrice: 99,
			bcvRateAtPurchase: 1
		});
		const rows = await getSessionLines(session.id, 'ALL');
		expect(rows.find((candidate) => candidate.id === line.id)?.fifoCostUsd).toBe(5);
		const map = await buildLineCostMap(rows);
		expect(map.get(line.id)).toBe(5);
	});

	it('diferencia de entrada (diff > 0) congela el costo vigente del lote', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: product.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10,
			unitPurchasePrice: 7,
			bcvRateAtPurchase: 1
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 1,
			countedStock: 2,
			difference: 1
		});
		await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});

		await applySession(session.id, admin.id);

		const [lot] = await db
			.select({ qty: inventoryLots.quantityAvailable })
			.from(inventoryLots)
			.where(eq(inventoryLots.productId, product.id));
		expect(lot.qty).toBe(11); // entrada +1
		const rows = await getSessionLines(session.id, 'ALL');
		expect(rows.find((candidate) => candidate.id === line.id)?.fifoCostUsd).toBe(7);
		const map = await buildLineCostMap(rows);
		expect(map.get(line.id)).toBe(7);
	});

	it('LENS: congela el costo del lote del cristal y el mapa lo prefiere', async () => {
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
				stock: 2
			})
			.returning();
		await createInventoryLot({
			itemType: 'LENS',
			productId: null,
			lensCatalogItemId: lens.id,
			quantityInitial: 2,
			quantityAvailable: 2,
			unitPurchasePrice: 40,
			bcvRateAtPurchase: 1
		});
		const session = await createInventoryCountSession({ openedById: admin.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'LENS',
			lensCatalogItemId: lens.id,
			productId: null,
			systemStock: 2,
			countedStock: 1,
			difference: -1
		});
		await requestCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});

		await applySession(session.id, admin.id);

		const rows = await getSessionLines(session.id, 'ALL');
		expect(rows.find((candidate) => candidate.id === line.id)?.fifoCostUsd).toBe(40);
		const map = await buildLineCostMap(rows);
		expect(map.get(line.id)).toBe(40);
	});
});
