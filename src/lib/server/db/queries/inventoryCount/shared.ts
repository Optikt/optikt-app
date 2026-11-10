/**
 * Conteo Físico — internals privados compartidos: elegibilidad de ítems,
 * resolución del alcance (snapshot de líneas), agregados de sesión y etiquetas.
 * Se consume desde sessions.ts, lines.ts, coverage.ts y adjustments.ts.
 */
import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';

import type { DbOrTx } from '$lib/server/db/types';
import {
	inventoryCountLines,
	inventoryMovements,
	products,
	users,
	brands,
	suppliers,
	lensCatalogItems,
	type InventoryCountSession
} from '$lib/server/db/schema';
import { UserRole } from '$lib/shared/enums';
import { getProductTypeLabel } from '$lib/shared/enums/productTypes';
import { daysSince } from '$lib/shared/inventoryCount';
import type { InventoryCountScopeDim, InventoryCountScopeKind } from '$lib/schemas/inventoryCount';
import type { CountSessionSummary, ScopeSelection } from './types';

export type CountUserRow = { id: string; fullName: string; role: UserRole };

// ── Guardas y normalización ────────────────────────────────────────────────

export function requireOpenSession(
	session: InventoryCountSession | null
): asserts session is InventoryCountSession {
	if (!session) throw new Error('Sesión de conteo no encontrada');
	requireOpenSessionStatus(session.status);
}

/** Mismos mensajes que `requireOpenSession`, para lecturas que solo traen `status` (1 query). */
export function requireOpenSessionStatus(status: string | null): void {
	if (status == null) throw new Error('Sesión de conteo no encontrada');
	if (status !== 'OPEN') throw new Error('La sesión ya no está abierta');
}

export function normalizeSessionNotes(notes?: string | null): string | null {
	const value = notes?.trim();
	return value ? value : null;
}

export function isAdminRole(role: string): boolean {
	return role === UserRole.ADMIN || role === UserRole.MANAGER;
}

// ── SQL helpers de líneas ───────────────────────────────────────────────────

/** Conteo válido de una línea: recuento (Revisar) si existe; si no, conteo primario. */
export const FINAL_COUNT_SQL = sql`coalesce(${inventoryCountLines.recountedStock}, ${inventoryCountLines.countedStock})`;
/** Diferencia final: conteo final − stock del sistema (snapshot). */
export const FINAL_DIFF_SQL = sql`coalesce(${inventoryCountLines.recountedStock}, ${inventoryCountLines.countedStock}) - ${inventoryCountLines.systemStock}`;

export async function getUserMap(
	userIds: Array<string | null | undefined>,
	executor: DbOrTx
): Promise<Map<string, CountUserRow>> {
	const uniqueUserIds = [...new Set(userIds.filter((userId): userId is string => Boolean(userId)))];
	if (uniqueUserIds.length === 0) return new Map();
	const rows = await executor
		.select({ id: users.id, fullName: users.fullName, role: users.role })
		.from(users)
		.where(inArray(users.id, uniqueUserIds));
	return new Map(rows.map((row) => [row.id, row]));
}

// ── Elegibilidad de ítems (compartida por snapshot y cobertura) ────────────

/** Producto elegible: no borrado y (stock > 0 o con algún movimiento). */
export function productEligibilityFilter(): SQL {
	return sql`(
		coalesce(${products.stock}, 0) > 0
		or exists (
			select 1 from ${inventoryMovements}
			where ${inventoryMovements.productId} = ${products.id}
		)
	)`;
}

/** Lente elegible: no borrado, modo STOCK y (stock > 0 o con algún movimiento). */
export function lensEligibilityFilter(): SQL {
	return sql`(
		coalesce(${lensCatalogItems.stock}, 0) > 0
		or exists (
			select 1 from ${inventoryMovements}
			where ${inventoryMovements.lensCatalogItemId} = ${lensCatalogItems.id}
		)
	)`;
}

// ── Snapshot: selección de ítems por alcance ───────────────────────────────

interface SnapshotOptionRow extends SnapshotRow {
	lastCountedAt: string | null;
}

interface SnapshotRow {
	itemType: 'PRODUCT' | 'LENS';
	productId: string | null;
	lensCatalogItemId: string | null;
	systemStock: number;
}

async function selectProductSnapshotRows(
	values: string[],
	executor: DbOrTx,
	options: { byBrand?: boolean; bySupplier?: boolean; byType?: boolean } = {}
): Promise<SnapshotOptionRow[]> {
	const conditions: SQL[] = [isNull(products.deletedAt), productEligibilityFilter()];
	if (options.byBrand) conditions.push(inArray(products.brandId, values));
	if (options.bySupplier) conditions.push(inArray(products.supplierId, values));
	if (options.byType) conditions.push(inArray(products.type, values));

	const rows = await executor
		.select({
			productId: products.id,
			systemStock: sql<number>`coalesce(${products.stock}, 0)`.mapWith(Number),
			lastCountedAt: products.lastCountedAt
		})
		.from(products)
		.where(and(...conditions))
		.orderBy(asc(products.name));

	return rows.map((row) => ({
		itemType: 'PRODUCT' as const,
		productId: row.productId,
		lensCatalogItemId: null,
		systemStock: row.systemStock,
		lastCountedAt: row.lastCountedAt
	}));
}

async function selectLensSnapshotRows(
	values: string[],
	executor: DbOrTx
): Promise<SnapshotOptionRow[]> {
	const rows = await executor
		.select({
			lensId: lensCatalogItems.id,
			systemStock: sql<number>`coalesce(${lensCatalogItems.stock}, 0)`.mapWith(Number),
			lastCountedAt: lensCatalogItems.lastCountedAt
		})
		.from(lensCatalogItems)
		.where(
			and(
				isNull(lensCatalogItems.deletedAt),
				eq(lensCatalogItems.inventoryMode, 'STOCK'),
				lensEligibilityFilter(),
				values.length > 0 ? inArray(lensCatalogItems.supplierId, values) : undefined
			)
		)
		.orderBy(asc(lensCatalogItems.name));

	return rows.map((row) => ({
		itemType: 'LENS' as const,
		productId: null,
		lensCatalogItemId: row.lensId,
		systemStock: row.systemStock,
		lastCountedAt: row.lastCountedAt
	}));
}

async function selectAllSnapshotRows(executor: DbOrTx): Promise<SnapshotOptionRow[]> {
	const [productRows, lensRows] = await Promise.all([
		selectProductSnapshotRows([], executor),
		selectLensSnapshotRows([], executor)
	]);
	return [...productRows, ...lensRows];
}

/**
 * Construye e inserta las líneas snapshot de la sesión según el alcance.
 * La elegibilidad es la misma que siempre: no borrados y (stock > 0 o con movimientos).
 * Devuelve la cantidad de líneas insertadas.
 */
export async function createSnapshotLines(
	sessionId: number,
	scope: ScopeSelection,
	executor: DbOrTx
): Promise<number> {
	let rows: SnapshotOptionRow[];

	if (scope.kind === 'QUICK_OLDEST') {
		rows = pickMostStale(await selectAllSnapshotRows(executor), scope.n);
	} else if (scope.kind === 'QUICK_NEVER') {
		rows = (await selectAllSnapshotRows(executor)).filter((row) => row.lastCountedAt == null);
	} else if (scope.kind === 'BRAND') {
		rows = await selectProductSnapshotRows(scope.values, executor, { byBrand: true });
	} else if (scope.kind === 'SUPPLIER') {
		const [productRows, lensRows] = await Promise.all([
			selectProductSnapshotRows(scope.values, executor, { bySupplier: true }),
			selectLensSnapshotRows(scope.values, executor)
		]);
		rows = [...productRows, ...lensRows];
	} else if (scope.kind === 'TYPE') {
		rows = await selectProductSnapshotRows(scope.values, executor, { byType: true });
	} else {
		rows = await selectAllSnapshotRows(executor);
	}

	if (rows.length === 0) {
		throw new Error('No hay ítems elegibles para este conteo');
	}

	if (scope.kind === 'QUICK_OLDEST' && scope.n != null) {
		rows = rows.slice(0, scope.n);
	}

	await executor.insert(inventoryCountLines).values(
		rows.map((row) => ({
			sessionId,
			itemType: row.itemType,
			productId: row.productId,
			lensCatalogItemId: row.lensCatalogItemId,
			systemStock: row.systemStock,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString()
		}))
	);

	return rows.length;
}

/** «Los N más atrasados»: toda el inventario ordenado por días desde el último conteo. */
function pickMostStale(rows: SnapshotOptionRow[], n: number | null): SnapshotOptionRow[] {
	const age = (row: { lastCountedAt: string | null }): number =>
		daysSince(row.lastCountedAt) ?? Number.MAX_SAFE_INTEGER;
	const sorted = [...rows].sort((a, b) => age(b) - age(a));
	return n == null ? sorted : sorted.slice(0, n);
}

// ── Agregados por sesión ─────────────────────────────────────────────────────

export interface SessionLineSummary {
	totalLines: number;
	verifiedLines: number;
	pendingLines: number;
	positiveDifferences: number;
	negativeDifferences: number;
	matchedLines: number;
}

export async function getSessionLineSummaryMap(
	sessionIds: number[],
	executor: DbOrTx
): Promise<Map<number, SessionLineSummary>> {
	if (sessionIds.length === 0) return new Map();

	const rows = await executor
		.select({
			sessionId: inventoryCountLines.sessionId,
			totalLines: sql<number>`count(*)`.mapWith(Number),
			verifiedLines: sql<number>`count(*) filter (where ${FINAL_COUNT_SQL} is not null)`.mapWith(
				Number
			),
			positiveDifferences:
				sql<number>`count(*) filter (where ${FINAL_COUNT_SQL} is not null and ${FINAL_DIFF_SQL} > 0)`.mapWith(
					Number
				),
			negativeDifferences:
				sql<number>`count(*) filter (where ${FINAL_COUNT_SQL} is not null and ${FINAL_DIFF_SQL} < 0)`.mapWith(
					Number
				),
			matchedLines:
				sql<number>`count(*) filter (where ${FINAL_COUNT_SQL} is not null and ${FINAL_DIFF_SQL} = 0)`.mapWith(
					Number
				)
		})
		.from(inventoryCountLines)
		.where(inArray(inventoryCountLines.sessionId, sessionIds))
		.groupBy(inventoryCountLines.sessionId);

	return new Map(
		rows.map((row) => [
			row.sessionId,
			{ ...row, pendingLines: Math.max(row.totalLines - row.verifiedLines, 0) }
		])
	);
}

// ── Etiquetas del alcance ───────────────────────────────────────────────────

/** Resuelve los ids del alcance a etiquetas (nombres de marca/proveedor o tipo). */
export async function resolveScopeValueLabels(
	dim: InventoryCountScopeDim,
	values: string[],
	executor: DbOrTx
): Promise<string[]> {
	if (values.length === 0) return [];
	if (dim === 'TYPE') return values.map((value) => getProductTypeLabel(value));
	if (dim === 'BRAND') {
		const rows = await executor
			.select({ id: brands.id, name: brands.name })
			.from(brands)
			.where(inArray(brands.id, values));
		const map = new Map(rows.map((row) => [row.id, row.name]));
		return values.map((id) => map.get(id) ?? id);
	}
	if (dim === 'SUPPLIER') {
		const rows = await executor
			.select({ id: suppliers.id, name: suppliers.name })
			.from(suppliers)
			.where(inArray(suppliers.id, values));
		const map = new Map(rows.map((row) => [row.id, row.name]));
		return values.map((id) => map.get(id) ?? id);
	}
	return values;
}

/** Etiqueta legible del alcance (sesiones legacy y nuevas). */
export function buildScopeLabel(
	kind: InventoryCountScopeKind,
	dim: InventoryCountScopeDim,
	valueLabels: string[],
	n: number | null
): string {
	if (kind === 'QUICK_OLDEST') return `Los ${n ?? 0} más atrasados`;
	if (kind === 'QUICK_NEVER') return 'Solo nunca contados';
	if (dim === 'ALL' || valueLabels.length === 0) return 'Todo el inventario';
	const dimName = dim === 'BRAND' ? 'Marca' : dim === 'SUPPLIER' ? 'Proveedor' : 'Tipo';
	if (valueLabels.length === 1) return `${dimName}: ${valueLabels[0]}`;
	return `${dimName}: ${valueLabels[0]} + ${valueLabels.length - 1}`;
}

function legacyLabelFor(session: InventoryCountSession): string {
	// Sesiones anteriores al rediseño: scopeType = ALL | PRODUCT_CATEGORY | LENS
	if (session.scopeKind != null) return 'Todo el inventario';
	if (session.scopeType === 'LENS') return 'Solo lentes STOCK';
	if (session.scopeType === 'PRODUCT_CATEGORY') {
		return session.scopeValue
			? `Solo productos - ${getProductTypeLabel(session.scopeValue)}`
			: 'Solo productos';
	}
	return 'Todo el inventario';
}

export async function scopeLabelForSession(
	session: InventoryCountSession,
	executor: DbOrTx
): Promise<string> {
	const legacy = legacyLabelFor(session);
	if (legacy) return legacy;

	const kind = (session.scopeKind ?? 'ALL') as InventoryCountScopeKind;
	const dim = (session.scopeDim ?? 'ALL') as InventoryCountScopeDim;
	const valueLabels = await resolveScopeValueLabels(dim, session.scopeValues ?? [], executor);
	return buildScopeLabel(kind, dim, valueLabels, session.scopeN);
}

// ── Enriquecimiento de sesiones (lista / detalle) ─────────────────────────

/** Une etiquetas en el formato del scope dim («Marca: X + N-1»). */
function joinDimLabel(dimName: string, valueLabels: string[]): string {
	if (valueLabels.length === 0) return dimName;
	if (valueLabels.length === 1) return `${dimName}: ${valueLabels[0]}`;
	return `${dimName}: ${valueLabels[0]} + ${valueLabels.length - 1}`;
}

/**
 * Resuelve etiquetas de alcance para TODAS las sesiones en lote
 * (una consulta por catálogo, nunca una por sesión).
 */
async function resolveScopeLabelsBatch(
	sessions: InventoryCountSession[],
	executor: DbOrTx
): Promise<Map<number, string>> {
	const labels = new Map<number, string>();
	const pending: Array<{ session: InventoryCountSession; dim: InventoryCountScopeDim }> = [];
	const brandIds = new Set<string>();
	const supplierIds = new Set<string>();

	for (const session of sessions) {
		if (session.scopeKind == null) {
			labels.set(session.id, legacyLabelFor(session));
			continue;
		}
		const dim = (session.scopeDim ?? 'ALL') as InventoryCountScopeDim;
		const values = session.scopeValues ?? [];
		if (session.scopeKind === 'QUICK_OLDEST') {
			labels.set(session.id, `Los ${session.scopeN ?? 0} más atrasados`);
			continue;
		}
		if (session.scopeKind === 'QUICK_NEVER') {
			labels.set(session.id, 'Solo nunca contados');
			continue;
		}
		if (dim === 'ALL' || values.length === 0) {
			labels.set(session.id, 'Todo el inventario');
			continue;
		}
		if (dim === 'TYPE') {
			labels.set(
				session.id,
				joinDimLabel(
					'Tipo',
					values.map((v) => getProductTypeLabel(v))
				)
			);
			continue;
		}
		if (dim === 'BRAND') values.forEach((v) => brandIds.add(v));
		else values.forEach((v) => supplierIds.add(v));
		pending.push({ session, dim });
	}

	const nameById = new Map<string, string>();
	if (brandIds.size > 0) {
		const rows = await executor
			.select({ id: brands.id, name: brands.name })
			.from(brands)
			.where(inArray(brands.id, [...brandIds]));
		rows.forEach((row) => nameById.set(row.id, row.name));
	}
	if (supplierIds.size > 0) {
		const rows = await executor
			.select({ id: suppliers.id, name: suppliers.name })
			.from(suppliers)
			.where(inArray(suppliers.id, [...supplierIds]));
		rows.forEach((row) => nameById.set(row.id, row.name));
	}

	for (const pendingEntry of pending) {
		const valueLabels = (pendingEntry.session.scopeValues ?? []).map((v) => nameById.get(v) ?? v);
		labels.set(
			pendingEntry.session.id,
			joinDimLabel(pendingEntry.dim === 'BRAND' ? 'Marca' : 'Proveedor', valueLabels)
		);
	}

	return labels;
}

export async function enrichSessions(
	sessions: InventoryCountSession[],
	executor: DbOrTx
): Promise<CountSessionSummary[]> {
	if (sessions.length === 0) return [];

	const [userMap, summaryMap, labelMap] = await Promise.all([
		getUserMap(
			sessions.flatMap((s) => [s.openedById, s.appliedById, s.cancelledById]),
			executor
		),
		getSessionLineSummaryMap(
			sessions.map((s) => s.id),
			executor
		),
		resolveScopeLabelsBatch(sessions, executor)
	]);

	return sessions.map((session) => {
		const scopeLabel = labelMap.get(session.id) ?? 'Todo el inventario';
		const summary = summaryMap.get(session.id);

		return {
			...session,
			openedByName: userMap.get(session.openedById)?.fullName ?? null,
			appliedByName: session.appliedById
				? (userMap.get(session.appliedById)?.fullName ?? null)
				: null,
			cancelledByName: session.cancelledById
				? (userMap.get(session.cancelledById)?.fullName ?? null)
				: null,
			scopeLabel,
			totalLines: summary?.totalLines ?? 0,
			verifiedLines: summary?.verifiedLines ?? 0,
			pendingLines: summary?.pendingLines ?? 0,
			positiveDifferences: summary?.positiveDifferences ?? 0,
			negativeDifferences: summary?.negativeDifferences ?? 0,
			matchedLines: summary?.matchedLines ?? 0
		} satisfies CountSessionSummary;
	});
}
