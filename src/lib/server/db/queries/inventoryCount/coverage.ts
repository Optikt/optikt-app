/**
 * Conteo Físico — cobertura: resumen del ciclo (semáforo), grupos por
 * marca / proveedor / tipo, opciones de alcance y vista previa viva.
 */
import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import {
	suppliers,
	products,
	inventoryMovements,
	lensCatalogItems,
	brands
} from '$lib/server/db/schema';
import { ALL_PRODUCT_TYPES } from '$lib/shared/enums';
import { getProductTypeLabel } from '$lib/shared/enums/productTypes';
import { getLensTypeLabel } from '$lib/shared/enums/lensTypes';
import {
	daysSince,
	summarizeCoverage,
	trafficStateByMedianAge,
	medianOf,
	type CountCycleConfig,
	type CoverageSummary
} from '$lib/shared/inventoryCount';

import { productEligibilityFilter, lensEligibilityFilter } from './shared';
import type { ScopeSelection } from './types';

export type CoverageDim = 'BRAND' | 'SUPPLIER' | 'TYPE';

const NEVER_AGE = 999_999;

export function itemAgeDays(item: { lastCountedAt: string | null }): number {
	if (item.lastCountedAt == null) return NEVER_AGE;
	return daysSince(item.lastCountedAt) ?? NEVER_AGE;
}

// ── Grupos por dimensión ─────────────────────────────────────────────────────

function groupNameOf(dim: CoverageDim, item: CoverageItemRow): string {
	if (dim === 'BRAND') return item.brandName;
	if (dim === 'SUPPLIER') return item.supplierName;
	return item.typeLabel;
}

export function buildCoverageGroups(
	dim: CoverageDim,
	items: CoverageItemRow[],
	cycleDays: number
): CoverageGroupRow[] {
	const groups = new Map<string, CoverageItemRow[]>();
	for (const item of items) {
		const name = groupNameOf(dim, item);
		const bucket = groups.get(name) ?? [];
		bucket.push(item);
		groups.set(name, bucket);
	}

	return [...groups.entries()]
		.map(([name, bucket]) => {
			const countedAges = bucket
				.filter((item) => item.lastCountedAt != null)
				.map((item) => itemAgeDays(item))
				.filter((age) => age < NEVER_AGE);
			const verifiedCount = countedAges.filter((age) => age <= cycleDays).length;
			const medianAgeDays = medianOf(countedAges);
			return {
				value: name,
				name,
				itemCount: bucket.length,
				verifiedCount,
				verifiedPercent: Math.round((verifiedCount / Math.max(bucket.length, 1)) * 100),
				medianAgeDays,
				trafficState: trafficStateByMedianAge(medianAgeDays, cycleDays),
				movementsSince: bucket.reduce((sum, item) => sum + item.movementsSince, 0)
			} satisfies CoverageGroupRow;
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

export interface CoverageGroupRow {
	value: string;
	name: string;
	itemCount: number;
	verifiedCount: number;
	verifiedPercent: number;
	medianAgeDays: number | null;
	trafficState: 'ok' | 'soon' | 'over' | 'none';
	movementsSince: number;
}

export interface CoverageData {
	summary: CoverageSummary;
	groups: Record<CoverageDim, CoverageGroupRow[]>;
	options: Record<CoverageDim, CoverageOptionRow[]>;
}

export interface CoverageOptionRow {
	id: string;
	name: string;
	itemCount: number;
	trafficState: 'ok' | 'soon' | 'over' | 'none';
}

/** Resumen + grupos + opciones de combobox en una sola llamada (load de Cobertura). */
export async function getCoverage(cycleDays: number, executor: DbOrTx = db): Promise<CoverageData> {
	const items = await selectCoverageItems(executor);

	const summary = summarizeCoverage(
		items.map((item) => ({ lastCountedAt: item.lastCountedAt, createdAt: item.createdAt })),
		cycleDays
	);

	const groups: Record<CoverageDim, CoverageGroupRow[]> = {
		BRAND: buildCoverageGroups('BRAND', items, cycleDays),
		SUPPLIER: buildCoverageGroups('SUPPLIER', items, cycleDays),
		TYPE: buildCoverageGroups('TYPE', items, cycleDays)
	};

	const options: Record<CoverageDim, CoverageOptionRow[]> = {
		BRAND: await optionsForCatalogDim('BRAND', groups.BRAND, executor),
		SUPPLIER: await optionsForCatalogDim('SUPPLIER', groups.SUPPLIER, executor),
		TYPE: ALL_PRODUCT_TYPES.map((type) => {
			const name = getProductTypeLabel(type);
			const group = groups.TYPE.find((row) => row.value === name);
			return {
				id: type,
				name,
				itemCount: group?.itemCount ?? 0,
				trafficState: group?.trafficState ?? 'none'
			};
		})
	};

	return { summary, groups, options };
}

/**
 * Marca | Proveedor: catálogo completo (incluye sin ítems eligibles) con conteos
 * y semáforo desde los grupos construidos.
 */
async function optionsForCatalogDim(
	dim: CoverageDim,
	groups: CoverageGroupRow[],
	executor: DbOrTx
): Promise<CoverageOptionRow[]> {
	const byName = new Map(groups.map((group) => [group.value, group]));
	if (dim === 'BRAND') {
		const rows = await executor
			.select({ id: brands.id, name: brands.name })
			.from(brands)
			.where(isNull(brands.deletedAt))
			.orderBy(asc(brands.name));
		return rows.map((row) => toOption(row.id, row, byName));
	}
	const rows = await executor
		.select({ id: suppliers.id, name: suppliers.name })
		.from(suppliers)
		.orderBy(asc(suppliers.name));
	return rows.map((row) => toOption(row.id, row, byName));
}

type CatalogRow = { id: string; name: string };

function toOption(
	id: string,
	row: CatalogRow,
	byName: Map<string, CoverageGroupRow>
): CoverageOptionRow {
	const group = byName.get(row.name);
	return {
		id,
		name: row.name,
		itemCount: group?.itemCount ?? 0,
		trafficState: group?.trafficState ?? 'none'
	};
}

// ── Vista previa viva del alcance ───────────────────────────────────────────

export interface ScopePreview {
	total: number;
	zeroStock: number;
	oldestAgeDays: number | null;
	neverCounted: number;
}

/** Filtra los ítems elegibles por el alcance elegido (quick o por dimensión). */
export function filterScopeItems(
	scope: Pick<ScopeSelection, 'kind' | 'dim' | 'values' | 'n'>,
	items: CoverageItemRow[],
	config: Pick<CountCycleConfig, 'quickOldestLimit'>
): CoverageItemRow[] {
	if (scope.kind === 'QUICK_NEVER') {
		return items.filter((item) => item.lastCountedAt == null);
	}
	if (scope.kind === 'QUICK_OLDEST') {
		const limit = scope.n ?? config.quickOldestLimit;
		return [...items].sort((a, b) => itemAgeDays(b) - itemAgeDays(a)).slice(0, limit);
	}
	if (scope.dim === 'ALL' || scope.kind === 'ALL') return items;
	return items.filter((item) => scope.values.includes(groupNameOf(scopeToGroupDim(scope), item)));
}

function scopeToGroupDim(scope: Pick<ScopeSelection, 'kind' | 'dim'>): CoverageDim {
	if (scope.dim === 'BRAND') return 'BRAND';
	if (scope.dim === 'SUPPLIER') return 'SUPPLIER';
	return 'TYPE';
}

export async function previewScope(
	scope: Pick<ScopeSelection, 'kind' | 'dim' | 'values' | 'n'>,
	config: Pick<CountCycleConfig, 'quickOldestLimit'>,
	executor: DbOrTx = db
): Promise<ScopePreview> {
	const items = filterScopeItems(scope, await selectCoverageItems(executor), config);
	const countedAges = items
		.filter((item) => item.lastCountedAt != null)
		.map((item) => itemAgeDays(item))
		.filter((age) => age < NEVER_AGE);
	return {
		total: items.length,
		zeroStock: items.filter((item) => item.stock === 0).length,
		oldestAgeDays: countedAges.length ? Math.max(...countedAges) : null,
		neverCounted: items.filter((item) => item.lastCountedAt == null).length
	};
}

// ── Cobertura: filas de ítems elegibles con metadata y movimientos ──────────

export interface CoverageItemRow {
	itemType: 'PRODUCT' | 'LENS';
	productId: string | null;
	lensCatalogItemId: string | null;
	name: string;
	typeLabel: string;
	brandName: string;
	supplierName: string;
	stock: number;
	lastCountedAt: string | null;
	createdAt: string | null;
	/** Movimientos desde el último conteo cerrado (todos, si nunca se contó). */
	movementsSince: number;
}

/** Todos los ítems elegibles con su semáforo, agrupado luego en cobertura. */
export async function selectCoverageItems(executor: DbOrTx): Promise<CoverageItemRow[]> {
	const [productRows, lensRows] = await Promise.all([
		executor
			.select({
				id: products.id,
				name: products.name,
				type: products.type,
				brandName: brands.name,
				supplierName: suppliers.name,
				stock: sql<number>`coalesce(${products.stock}, 0)`.mapWith(Number),
				lastCountedAt: products.lastCountedAt,
				createdAt: products.createdAt,
				movementsSince: sql<number>`(
					select count(*) from ${inventoryMovements}
					where ${inventoryMovements.productId} = ${products.id}
						and (${products.lastCountedAt} is null or ${inventoryMovements.createdAt} > ${products.lastCountedAt})
				)`.mapWith(Number)
			})
			.from(products)
			.leftJoin(brands, eq(products.brandId, brands.id))
			.leftJoin(suppliers, eq(products.supplierId, suppliers.id))
			.where(and(isNull(products.deletedAt), productEligibilityFilter()))
			.orderBy(asc(products.name)),
		executor
			.select({
				id: lensCatalogItems.id,
				name: lensCatalogItems.name,
				type: lensCatalogItems.type,
				supplierName: suppliers.name,
				stock: sql<number>`coalesce(${lensCatalogItems.stock}, 0)`.mapWith(Number),
				lastCountedAt: lensCatalogItems.lastCountedAt,
				createdAt: lensCatalogItems.createdAt,
				movementsSince: sql<number>`(
					select count(*) from ${inventoryMovements}
					where ${inventoryMovements.lensCatalogItemId} = ${lensCatalogItems.id}
						and (${lensCatalogItems.lastCountedAt} is null or ${inventoryMovements.createdAt} > ${lensCatalogItems.lastCountedAt})
				)`.mapWith(Number)
			})
			.from(lensCatalogItems)
			.leftJoin(suppliers, eq(lensCatalogItems.supplierId, suppliers.id))
			.where(
				and(
					isNull(lensCatalogItems.deletedAt),
					eq(lensCatalogItems.inventoryMode, 'STOCK'),
					lensEligibilityFilter()
				)
			)
			.orderBy(asc(lensCatalogItems.name))
	]);

	const productItems = productRows.map((row): CoverageItemRow => ({
		itemType: 'PRODUCT',
		productId: row.id,
		lensCatalogItemId: null,
		name: row.name,
		typeLabel: getProductTypeLabel(row.type),
		brandName: row.brandName ?? '—',
		supplierName: row.supplierName ?? '—',
		stock: row.stock,
		lastCountedAt: row.lastCountedAt,
		createdAt: row.createdAt,
		movementsSince: row.movementsSince
	}));

	const lensItems = lensRows.map((row): CoverageItemRow => ({
		itemType: 'LENS',
		productId: null,
		lensCatalogItemId: row.id,
		name: row.name,
		typeLabel: getLensTypeLabel(row.type),
		brandName: '—',
		supplierName: row.supplierName ?? '—',
		stock: row.stock,
		lastCountedAt: row.lastCountedAt,
		createdAt: row.createdAt,
		movementsSince: row.movementsSince
	}));

	return [...productItems, ...lensItems];
}
