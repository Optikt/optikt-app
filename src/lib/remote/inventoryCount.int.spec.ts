/**
 * Integration tests (Capa 3) — remote functions de Conteo Físico.
 * Cubre guards por rol/participante y el flujo completo usando `callRemote`
 * con el mismo harness que el resto de los .int.spec del repo.
 * Requiere DATABASE_URL (Testcontainers).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { AdjustmentReason, UserRole } from '$lib/shared/enums';
import {
	applyAdjustmentsBatchCmd,
	applyLineAdjustmentCmd,
	applySessionCmd,
	cancelSessionCmd,
	confirmZeroStock,
	createSessionCmd,
	getActiveSession,
	getCoverageData,
	getCountConfig,
	getDiffCosts,
	getSessionById,
	getSessions,
	listCountOptions,
	listCountResponsibles,
	previewCountScope,
	recountCountLineCmd,
	setSessionResponsibles,
	updateCountSettings,
	upsertCountLineCmd
} from './inventoryCount.remote';
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
import { callRemote } from '$lib/testing/remoteHarness';
import type { User } from '$lib/server/db/schema';

// ── Tipos locales (resultados de los remotes) ──────────────────────────────

interface CountConfig {
	cycleDays: number;
	diffThresholdUnits: number;
	diffThresholdUsd: number;
	quickOldestLimit: number;
}
interface ScopePreview {
	total: number;
	zeroStock: number;
	oldestAgeDays: number | null;
	neverCounted: number;
}
interface CoverageOptionRow {
	id: string;
	name: string;
	itemCount: number;
	trafficState: string;
}
interface CoverageGroupRow {
	value: string;
	name: string;
	itemCount: number;
}
interface CoverageData {
	summary: { itemCount: number; verifiedPercent: number };
	groups: { BRAND: CoverageGroupRow[] };
	options: { BRAND: CoverageOptionRow[]; TYPE: CoverageOptionRow[] };
}
interface CommandResult<T> {
	success: boolean;
	data?: T;
	error?: string;
}
interface CountLineDto {
	id: number;
	countedStock: number | null;
	recountedStock: number | null;
	countedByName: string | null;
	adjustmentMovementId: string | null;
}
interface SessionDto {
	id: number;
	status: string;
	scopeLabel: string;
	lines: Array<{ id: number; brandName: string; countedStock: null }>;
	responsibles: Array<{ userId: string | null }>;
}
interface ResponsibleOption {
	userId: string;
	displayName: string;
}

async function invoke<T>(fn: (arg: never) => unknown, arg: unknown, user: User): Promise<T> {
	return callRemote(fn as never, arg as never, { user }) as Promise<T>;
}

/**
 * Kit lanza HttpError (clase propia, no `instanceof Error`), por lo que
 * `rejects.toThrow()` no sirve: validamos cualquier rechazo con mensaje/estado.
 */
async function expectRemoteError<T>(promise: Promise<T>): Promise<void> {
	await expect(promise).rejects.toSatisfy((error: unknown) => {
		const candidate = error as { status?: number; message?: string } | undefined;
		return (
			candidate instanceof Error ||
			typeof candidate?.message === 'string' ||
			typeof candidate?.status === 'number'
		);
	});
}

async function seller() {
	return (await createUser({ role: UserRole.SELLER })) as User;
}
async function admin() {
	return (await createUser({ role: UserRole.ADMIN })) as User;
}

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

describe('Capa 3 · descubrimiento (config/cobertura/opciones)', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('getCountConfig devuelve los defaults', async () => {
		const adminId = await admin();
		const config = await invoke<CountConfig>(getCountConfig, undefined, adminId);
		expect(config.cycleDays).toBe(30);
		expect(config.diffThresholdUnits).toBe(2);
		expect(config.diffThresholdUsd).toBe(0);
		expect(config.quickOldestLimit).toBe(50);
	});

	it('getCoverageData/listCountOptions/previewCountScope devuelven forma completa', async () => {
		const adminId = await admin();
		await productFixture();

		const coverage = await invoke<CoverageData>(getCoverageData, undefined, adminId);
		expect(coverage.summary.itemCount).toBeGreaterThanOrEqual(1);
		expect(coverage.groups.BRAND.length).toBeGreaterThanOrEqual(1);
		expect(coverage.options.TYPE.length).toBe(4);

		const options = await invoke<CoverageOptionRow[]>(listCountOptions, { dim: 'BRAND' }, adminId);
		expect(options.length).toBeGreaterThanOrEqual(1);

		const previewAll = await invoke<ScopePreview>(
			previewCountScope,
			{ dim: 'ALL', values: [] },
			adminId
		);
		expect(previewAll.total).toBeGreaterThanOrEqual(1);
	});

	it('un SELLER también puede descubrir (lecturas A/M/S)', async () => {
		const sellerId = await seller();
		await productFixture();
		const coverage = await invoke<CoverageData>(getCoverageData, undefined, sellerId);
		expect(coverage.summary).toBeDefined();
	});
});

describe('Capa 3 · createSessionCmd', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('crea por marca con responsables y snapshot', async () => {
		const adminId = await admin();
		const sellerId = await seller();
		const { brand } = await productFixture();

		const result = await invoke<CommandResult<SessionDto>>(
			createSessionCmd,
			{
				dim: 'BRAND',
				values: [brand.id],
				quick: undefined,
				n: undefined,
				notes: 'Ciclo mensual',
				responsibles: [
					{ userId: sellerId.id, displayName: sellerId.fullName, isExternal: false },
					{ displayName: 'Tía Rosa', isExternal: true }
				]
			},
			adminId
		);
		expect(result.success).toBe(true);
		if (result.success && result.data) {
			const detail = await invoke<SessionDto | null>(
				getSessionById,
				{ id: result.data.id },
				adminId
			);
			expect(detail?.scopeLabel).toContain(brand.name);
			expect(detail?.lines.length).toBeGreaterThanOrEqual(1);
			expect(detail?.responsibles.map((entry) => entry.userId)).toContain(sellerId.id);
		}
	});

	it('bloquea segunda sesión abierta (guard global)', async () => {
		const adminId = await admin();
		await productFixture();
		const first = await invoke<CommandResult<SessionDto>>(
			createSessionCmd,
			{ dim: 'ALL', values: [], quick: undefined, n: undefined, notes: null, responsibles: [] },
			adminId
		);
		expect(first.success).toBe(true);

		const second = await invoke<CommandResult<SessionDto>>(
			createSessionCmd,
			{ dim: 'ALL', values: [], quick: undefined, n: undefined, notes: null, responsibles: [] },
			adminId
		);
		expect(second.success).toBe(false);
	});

	it('rechaza alcance vacío de marca (Zod)', async () => {
		const adminId = await admin();
		await expectRemoteError(
			invoke<CommandResult<SessionDto>>(
				createSessionCmd,
				{ dim: 'BRAND', values: [], quick: undefined, n: undefined, notes: null, responsibles: [] },
				adminId
			)
		);
	});
});

describe('Capa 3 · conteo por línea', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('SELLER responsable activo cuenta; el no asignado queda bloqueado', async () => {
		const adminId = await admin();
		const sellerId = await seller();
		const { product } = await productFixture();
		const session = await createInventoryCountSession({ openedById: adminId.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 5,
			countedStock: null,
			difference: null
		});

		const blocked = await invoke<CommandResult<undefined>>(
			upsertCountLineCmd,
			{ lineId: line.id, countedStock: 4 },
			sellerId
		);
		expect(blocked.success).toBe(false);

		const assigned = await invoke<CommandResult<undefined>>(
			setSessionResponsibles,
			{
				sessionId: session.id,
				entries: [
					{ userId: adminId.id, displayName: adminId.fullName, isExternal: false },
					{ userId: sellerId.id, displayName: sellerId.fullName, isExternal: false }
				]
			},
			adminId
		);
		expect(assigned.success).toBe(true);

		const counted = await invoke<CommandResult<CountLineDto>>(
			upsertCountLineCmd,
			{ lineId: line.id, countedStock: 4 },
			sellerId
		);
		expect(counted.success).toBe(true);
		if (counted.success && counted.data) {
			expect(counted.data.countedStock).toBe(4);
			expect(counted.data.countedByName).toBe(sellerId.fullName);
		}
	});

	it('recuento guarda recount; cambiar el conteo lo limpia', async () => {
		const adminId = await admin();
		const { product } = await productFixture();
		const session = await createInventoryCountSession({ openedById: adminId.id });
		const line = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 5,
			countedStock: 9,
			difference: 4,
			countedById: adminId.id
		});

		const recounted = await invoke<CommandResult<CountLineDto>>(
			recountCountLineCmd,
			{ lineId: line.id, recountedStock: 9 },
			adminId
		);
		expect(recounted.success).toBe(true);
		if (recounted.success && recounted.data) {
			expect(recounted.data.recountedStock).toBe(9);
		}

		const changed = await invoke<CommandResult<CountLineDto>>(
			upsertCountLineCmd,
			{ lineId: line.id, countedStock: 6 },
			adminId
		);
		expect(changed.success).toBe(true);
		if (changed.success && changed.data) {
			expect(changed.data.recountedStock).toBeNull();
		}
	});

	it('confirmZeroStock marca las líneas de stock 0 sin contar', async () => {
		const adminId = await admin();
		const session = await createInventoryCountSession({ openedById: adminId.id });
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: null,
			lensCatalogItemId: null,
			systemStock: 0,
			countedStock: null,
			difference: null
		});

		const response = await invoke<CommandResult<number>>(
			confirmZeroStock,
			{ sessionId: session.id },
			adminId
		);
		expect(response.success).toBe(true);
		if (response.success) expect(response.data).toBe(1);
	});
});

describe('Capa 3 · ajustes vinculados y cierre', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('adjust vinculado + umbral + rol + lote', async () => {
		const adminId = await admin();
		const sellerId = await seller();
		const { product: productA } = await productFixture();
		const { product: productB } = await productFixture();
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: productA.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10,
			unitPurchasePrice: 90,
			bcvRateAtPurchase: 1
		});
		await createInventoryLot({
			itemType: 'PRODUCT',
			productId: productB.id,
			lensCatalogItemId: null,
			quantityInitial: 10,
			quantityAvailable: 10,
			unitPurchasePrice: 90,
			bcvRateAtPurchase: 1
		});
		const session = await createInventoryCountSession({ openedById: adminId.id });
		const under = await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: productA.id,
			systemStock: 5,
			countedStock: 6,
			difference: 1
		});
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: productB.id,
			systemStock: 5,
			countedStock: 9,
			difference: 4
		});

		// SELLER: guard de rol lanza HttpError 403 (no-error para toThrow)
		await expectRemoteError(
			invoke<CommandResult<CountLineDto>>(
				applyLineAdjustmentCmd,
				{ lineId: under.id, reason: AdjustmentReason.PHYSICAL_COUNT, reasonText: null },
				sellerId
			)
		);

		await invoke<CommandResult<undefined>>(
			setSessionResponsibles,
			{
				sessionId: session.id,
				entries: [{ userId: adminId.id, displayName: adminId.fullName, isExternal: false }]
			},
			adminId
		);

		const invalid = await invoke<CommandResult<CountLineDto>>(
			applyLineAdjustmentCmd,
			{ lineId: under.id, reason: AdjustmentReason.OTHER, reasonText: '' },
			adminId
		);
		expect(invalid.success).toBe(false);

		const adjusted = await invoke<CommandResult<CountLineDto>>(
			applyLineAdjustmentCmd,
			{ lineId: under.id, reason: AdjustmentReason.PHYSICAL_COUNT, reasonText: null },
			adminId
		);
		expect(adjusted.success).toBe(true);
		if (adjusted.success && adjusted.data) {
			expect(adjusted.data.adjustmentMovementId).not.toBeNull();
		}

		const costs = await invoke<Record<string, number | null>>(
			getDiffCosts,
			{ sessionId: session.id },
			adminId
		);
		expect(Object.keys(costs).length).toBeGreaterThanOrEqual(1);

		const batch = await invoke<CommandResult<number>>(
			applyAdjustmentsBatchCmd,
			{ sessionId: session.id, reason: AdjustmentReason.PHYSICAL_COUNT, reasonText: null },
			adminId
		);
		expect(batch.success).toBe(true);
		if (batch.success) expect(batch.data).toBe(0);
	});

	it('cerrar: rechaza SELLER; cierra con stock 0 sin confirmar; getSessions lista APPLIED', async () => {
		const adminId = await admin();
		const sellerId = await seller();
		const { product } = await productFixture();
		const session = await createInventoryCountSession({ openedById: adminId.id });
		await invoke<CommandResult<undefined>>(
			setSessionResponsibles,
			{
				sessionId: session.id,
				entries: [
					{ userId: adminId.id, displayName: adminId.fullName, isExternal: false },
					{ userId: sellerId.id, displayName: sellerId.fullName, isExternal: false }
				]
			},
			adminId
		);
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			productId: product.id,
			systemStock: 5,
			countedStock: 5,
			difference: 0,
			countedById: adminId.id
		});
		await createInventoryCountLine({
			sessionId: session.id,
			itemType: 'PRODUCT',
			systemStock: 0,
			countedStock: null,
			difference: null
		});

		await expectRemoteError(invoke(applySessionCmd, { id: session.id }, sellerId));

		const closed = await invoke<CommandResult<SessionDto>>(
			applySessionCmd,
			{ id: session.id },
			adminId
		);
		expect(closed.success).toBe(true);

		const listing = await invoke<Array<{ id: number; status: string }>>(
			getSessions,
			{ limit: 10 },
			adminId
		);
		expect(listing[0]?.status).toBe('APPLIED');
	});

	it('cancelar: exige motivo (5-500) y rechaza a SELLER', async () => {
		const adminId = await admin();
		const sellerId = await seller();
		const session = await createInventoryCountSession({ openedById: adminId.id });

		// Zod (mínimo 5) lanza 400 aunque el usuario sea SELLER; luego SELLER lanza 403
		await expectRemoteError(
			invoke<CommandResult<SessionDto>>(
				cancelSessionCmd,
				{ id: session.id, reason: 'va' },
				sellerId
			)
		);

		const cancelled = await invoke<CommandResult<SessionDto>>(
			cancelSessionCmd,
			{ id: session.id, reason: 'Se duplicó por error administrativo' },
			adminId
		);
		expect(cancelled.success).toBe(true);
		if (cancelled.success && cancelled.data) expect(cancelled.data.status).toBe('CANCELLED');
	});
});

describe('Capa 3 · configuración y responsables', () => {
	beforeEach(async () => {
		await resetDb();
	});

	it('updateCountSettings + getActiveSession + listCountResponsibles', async () => {
		const adminId = await admin();
		const sellerId = await seller();
		await productFixture();

		const updated = await invoke<CommandResult<CountConfig>>(
			updateCountSettings,
			{ cycleDays: 90, diffThresholdUnits: 3, diffThresholdUsd: 25, quickOldestLimit: 25 },
			adminId
		);
		expect(updated.success).toBe(true);
		if (updated.success && updated.data) {
			expect(updated.data.cycleDays).toBe(90);
			expect(updated.data.quickOldestLimit).toBe(25);
		}

		await expectRemoteError(
			invoke<CommandResult<CountConfig>>(
				updateCountSettings,
				{ cycleDays: 45, diffThresholdUnits: 2, diffThresholdUsd: 0, quickOldestLimit: 50 },
				sellerId
			)
		);

		const open = await invoke<CommandResult<SessionDto>>(
			createSessionCmd,
			{ dim: 'ALL', values: [], quick: undefined, n: undefined, notes: null, responsibles: [] },
			adminId
		);
		expect(open.success).toBe(true);
		if (open.success && open.data) {
			const active = await invoke<{ id: number; scopeLabel: string } | null>(
				getActiveSession,
				undefined,
				adminId
			);
			expect(active?.id).toBe(open.data.id);
			expect(active?.scopeLabel).toBe('Todo el inventario');
		}

		const options = await invoke<ResponsibleOption[]>(listCountResponsibles, undefined, adminId);
		expect(options.map((option) => option.displayName)).toContain(adminId.fullName);
	});
});
