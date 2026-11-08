/**
 * Integration tests for the Conteo Físico redesign:
 * nueva regla de cierre, responsables y acceso, ajuste vinculado a la línea,
 * upsertCountLine ligero con reset de derivados y alcance estructurado.
 *
 * Requiere DATABASE_URL (Testcontainers) — igual que el resto de suites .int.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AdjustmentReason } from '$lib/shared/enums';
import { applySession, cancelSession, createSession } from './sessions';
import { recountCountLine, upsertCountLine, getSessionLines } from './lines';
import { applyAdjustmentsBatch, applyCountLineAdjustment } from './adjustments';
import { syncSessionResponsibles, listSessionResponsibles } from './responsibles';
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

	it('un ajuste individual crea movement y lo vincula', async () => {
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

		const updated = await applyCountLineAdjustment({
			lineId: line.id,
			reason: AdjustmentReason.PHYSICAL_COUNT,
			reasonText: null,
			userId: admin.id
		});
		expect(updated.adjustmentMovementId).not.toBeNull();
	});

	it('«Aplicar todo» ajusta solo diferencias bajo el umbral', async () => {
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

		const applied = await applyAdjustmentsBatch(
			session.id,
			AdjustmentReason.PHYSICAL_COUNT,
			null,
			admin.id
		);
		expect(applied).toBe(1);

		const rows = await getSessionLines(session.id, 'ALL');
		const adjusted = rows.find((row) => row.productId === productA.id);
		const skipped = rows.find((row) => row.productId === productB.id);
		expect(adjusted?.adjustmentMovementId).not.toBeNull();
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
			applyCountLineAdjustment({
				lineId: line.id,
				reason: AdjustmentReason.PHYSICAL_COUNT,
				reasonText: null,
				userId: admin.id
			})
		).rejects.toThrow('lote');
	});
});

describe('upsertCountLine ligero + reset de derivados', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('devuelve solo la línea y limpia recuento/ajuste al cambiar el conteo', async () => {
		const admin = await createUser({ role: UserRole.ADMIN });
		const { product } = await productFixture();
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

		const changed = await upsertCountLine({ lineId: line.id, countedStock: 7, userId: admin.id });
		expect(changed.countedStock).toBe(7);
		expect(changed.recountedStock).toBeNull();
		expect(changed.difference).toBe(2);
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
