/**
 * Conteo Físico — líneas: lectura con joins ligeros, upsert del conteo
 * (retorna solo la línea), recuento de Revisar y confirmación en lote de stock 0.
 */
import { and, asc, eq, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import {
	inventoryCountLines,
	inventoryCountSessions,
	brands,
	lensCatalogItems,
	products,
	suppliers as suppliersTable,
	users,
	type InventoryCountLine
} from '$lib/server/db/schema';
import { getProductTypeLabel } from '$lib/shared/enums/productTypes';
import { getLensTypeLabel } from '$lib/shared/enums/lensTypes';
import {
	FINAL_COUNT_SQL,
	FINAL_DIFF_SQL,
	requireOpenSession,
	requireOpenSessionStatus,
	normalizeSessionNotes
} from './shared';
import type { CountLineRow, UpsertCountLineInput, RecountLineInput } from './types';

const countedByUser = alias(users, 'count_counted_by_user');
const recountedByUser = alias(users, 'count_recounted_by_user');
const adjustDoneByUser = alias(users, 'count_adjust_done_user');
const lensSupplier = alias(suppliersTable, 'count_lens_supplier');

const lineSelection = {
	line: inventoryCountLines,
	productName: products.name,
	productSku: products.sku,
	productType: products.type,
	lensName: lensCatalogItems.name,
	lensType: lensCatalogItems.type,
	brandName: brands.name,
	supplierName: suppliersTable.name,
	lensSupplierName: lensSupplier.name,
	countedByName: countedByUser.fullName,
	recountedByName: recountedByUser.fullName,
	adjustmentCompletedByName: adjustDoneByUser.fullName
};

type LineJoinRow = {
	line: InventoryCountLine;
	productName: string | null;
	productSku: string | null;
	productType: string | null;
	lensName: string | null;
	lensType: string | null;
	brandName: string | null;
	supplierName: string | null;
	lensSupplierName: string | null;
	countedByName: string | null;
	recountedByName: string | null;
	adjustmentCompletedByName: string | null;
};

function mapLine(row: LineJoinRow): CountLineRow {
	const isProduct = row.line.itemType === 'PRODUCT';
	return {
		...row.line,
		itemId: row.line.productId ?? row.line.lensCatalogItemId ?? '',
		itemName: row.productName ?? row.lensName ?? 'Ítem sin nombre',
		itemCode: isProduct ? row.productSku : row.lensType,
		typeLabel: isProduct
			? getProductTypeLabel(row.productType ?? '')
			: getLensTypeLabel(row.lensType ?? ''),
		brandName: row.brandName ?? '—',
		supplierName: isProduct ? (row.supplierName ?? '—') : (row.lensSupplierName ?? '—'),
		countedByName: row.countedByName,
		recountedByName: row.recountedByName,
		adjustmentCompletedByName: row.adjustmentCompletedByName
	};
}

const baseLineQuery = (executor: DbOrTx) =>
	executor
		.select(lineSelection)
		.from(inventoryCountLines)
		.leftJoin(products, eq(inventoryCountLines.productId, products.id))
		.leftJoin(brands, eq(products.brandId, brands.id))
		.leftJoin(suppliersTable, eq(products.supplierId, suppliersTable.id))
		.leftJoin(lensCatalogItems, eq(inventoryCountLines.lensCatalogItemId, lensCatalogItems.id))
		.leftJoin(lensSupplier, eq(lensCatalogItems.supplierId, lensSupplier.id))
		.leftJoin(countedByUser, eq(inventoryCountLines.countedById, countedByUser.id))
		.leftJoin(recountedByUser, eq(inventoryCountLines.recountedById, recountedByUser.id))
		.leftJoin(
			adjustDoneByUser,
			eq(inventoryCountLines.adjustmentCompletedById, adjustDoneByUser.id)
		)
		.orderBy(
			asc(inventoryCountLines.itemType),
			asc(products.name),
			asc(lensCatalogItems.name),
			asc(inventoryCountLines.id)
		);

/** Filtros server-side legacy compatibles con el nuevo conteo final. */
function lineFilterCondition(filter: 'ALL' | 'COUNTED' | 'PENDING' | 'WITH_DIFF'): SQL | undefined {
	if (filter === 'COUNTED') {
		return sql`${FINAL_COUNT_SQL} is not null`;
	}
	if (filter === 'PENDING') {
		return sql`${inventoryCountLines.countedStock} is null`;
	}
	if (filter === 'WITH_DIFF') {
		return sql`${FINAL_COUNT_SQL} is not null and ${FINAL_DIFF_SQL} != 0`;
	}
	return undefined;
}

/** Todas las líneas de la sesión con sus joins. La UI filtra/búsqueda localmente. */
export async function getSessionLines(
	sessionId: number,
	filter: 'ALL' | 'COUNTED' | 'PENDING' | 'WITH_DIFF' = 'ALL',
	executor: DbOrTx = db
): Promise<CountLineRow[]> {
	const conditions = [eq(inventoryCountLines.sessionId, sessionId)];
	const filterCondition = lineFilterCondition(filter);
	if (filterCondition) conditions.push(filterCondition);
	const rows = await baseLineQuery(executor).where(and(...conditions));
	return rows.map(mapLine);
}

export async function getLineById(
	lineId: number,
	executor: DbOrTx = db
): Promise<CountLineRow | null> {
	const [row] = await baseLineQuery(executor).where(eq(inventoryCountLines.id, lineId)).limit(1);
	return row ? mapLine(row) : null;
}

// ── Upsert del conteo (fase Contar) — devuelve solo la línea actualizada ───

export async function upsertCountLine(
	data: UpsertCountLineInput,
	executor: DbOrTx = db
): Promise<CountLineRow> {
	// 1) Lectura única: estado previo de la línea + status de la sesión (antes eran
	//    3 queries: sessionIdForLine + requireLineById con joins + sesión).
	const [line] = await executor
		.select({
			id: inventoryCountLines.id,
			sessionId: inventoryCountLines.sessionId,
			systemStock: inventoryCountLines.systemStock,
			countedStock: inventoryCountLines.countedStock,
			notes: inventoryCountLines.notes,
			recountedStock: inventoryCountLines.recountedStock,
			recountedById: inventoryCountLines.recountedById,
			recountedAt: inventoryCountLines.recountedAt,
			adjustmentMovementId: inventoryCountLines.adjustmentMovementId,
			adjustmentCompleted: inventoryCountLines.adjustmentCompleted,
			adjustmentCompletedById: inventoryCountLines.adjustmentCompletedById,
			adjustmentCompletedAt: inventoryCountLines.adjustmentCompletedAt,
			adjustmentReason: inventoryCountLines.adjustmentReason,
			adjustmentReasonText: inventoryCountLines.adjustmentReasonText,
			adjustmentRequestedBy: inventoryCountLines.adjustmentRequestedBy,
			adjustmentRequestedAt: inventoryCountLines.adjustmentRequestedAt,
			sessionStatus: inventoryCountSessions.status
		})
		.from(inventoryCountLines)
		.leftJoin(inventoryCountSessions, eq(inventoryCountLines.sessionId, inventoryCountSessions.id))
		.where(eq(inventoryCountLines.id, data.lineId))
		.limit(1);
	if (!line) throw new Error('La línea de conteo no existe');
	requireOpenSessionStatus(line.sessionStatus);

	const known = line.countedStock ?? null;
	const nextDiff = data.countedStock - line.systemStock;
	const previousDiff = known == null ? null : known - line.systemStock;
	const countChanged = known !== data.countedStock;

	// Invariante: cambiar el conteo invalida recuento, ajuste y tracking previo
	// (el movimiento de stock ya hecho queda como historial; el vínculo se libera).
	const resetDerived = countChanged || previousDiff == null || previousDiff !== nextDiff;
	const nextNotes =
		data.notes === undefined ? line.notes : normalizeSessionNotes(data.notes ?? null);
	const now = new Date().toISOString();

	// 2) Update con guard atómico: si la sesión se cerró entre la lectura y este
	//    write, el EXISTS filtra la fila y no se modifica nada (sin tx extra).
	//    El `system_stock` leído también va en el guard: si «Refrescar stock»
	//    cambió la referencia mientras este guardado volaba, el diff que vamos a
	//    grabar sería contra la referencia vieja → 0 filas y se reintenta.
	const updated = await executor
		.update(inventoryCountLines)
		.set({
			countedStock: data.countedStock,
			difference: nextDiff,
			countedById: data.userId,
			countedAt: now,
			notes: nextNotes ?? null,
			recountedStock: resetDerived ? null : line.recountedStock,
			recountedById: resetDerived ? null : line.recountedById,
			recountedAt: resetDerived ? null : line.recountedAt,
			adjustmentMovementId: resetDerived ? null : line.adjustmentMovementId,
			adjustmentCompleted: resetDerived ? false : line.adjustmentCompleted,
			adjustmentCompletedById: resetDerived ? null : line.adjustmentCompletedById,
			adjustmentCompletedAt: resetDerived ? null : line.adjustmentCompletedAt,
			// Cambiar el conteo también descarta una solicitud de ajuste pendiente.
			adjustmentReason: resetDerived ? null : line.adjustmentReason,
			adjustmentReasonText: resetDerived ? null : line.adjustmentReasonText,
			adjustmentRequestedBy: resetDerived ? null : line.adjustmentRequestedBy,
			adjustmentRequestedAt: resetDerived ? null : line.adjustmentRequestedAt,
			updatedAt: now
		})
		.where(
			and(
				eq(inventoryCountLines.id, line.id),
				eq(inventoryCountLines.systemStock, line.systemStock),
				sql`exists (
					select 1 from ${inventoryCountSessions}
					where ${inventoryCountSessions.id} = ${inventoryCountLines.sessionId}
						and ${inventoryCountSessions.status} = 'OPEN'
				)`
			)
		)
		.returning({ id: inventoryCountLines.id });
	if (updated.length === 0) {
		const [fresh] = await executor
			.select({
				systemStock: inventoryCountLines.systemStock,
				sessionStatus: inventoryCountSessions.status
			})
			.from(inventoryCountLines)
			.leftJoin(
				inventoryCountSessions,
				eq(inventoryCountLines.sessionId, inventoryCountSessions.id)
			)
			.where(eq(inventoryCountLines.id, line.id))
			.limit(1);
		if (fresh && fresh.sessionStatus === 'OPEN' && fresh.systemStock !== line.systemStock) {
			throw new Error(
				'El stock del sistema cambió mientras guardabas: la línea se recargó, revisa y guarda de nuevo'
			);
		}
		throw new Error('La sesión ya no está abierta');
	}

	// 3) DTO enriquecido (joins de marca/proveedor/usuarios) solo al final.
	const full = await getLineById(line.id, executor);
	if (!full) throw new Error('No se pudo recargar la línea actualizada');
	return full;
}

// ── Recuento (fase Revisar) ─────────────────────────────────────────────────

export async function recountCountLine(
	data: RecountLineInput,
	executor: DbOrTx = db
): Promise<CountLineRow> {
	const line = await requireLineById(data.lineId, executor);
	const [session] = await executor
		.select()
		.from(inventoryCountSessions)
		.where(eq(inventoryCountSessions.id, line.sessionId))
		.limit(1);
	requireOpenSession(session ?? null);
	if (line.countedStock == null) {
		throw new Error('La línea aún no tiene un conteo que se pueda recontar');
	}

	const recordedFinal = line.recountedStock ?? line.countedStock;
	const previousDiff = recordedFinal - line.systemStock;
	const countedDiff = line.countedStock - line.systemStock;
	const recountDiff = data.recountedStock - line.systemStock;

	const diffChanges = previousDiff !== recountDiff || countedDiff !== recountDiff;
	const now = new Date().toISOString();

	// Guard en el WHERE: `system_stock` es mutable en sesión OPEN («Refrescar
	// stock»). Si cambió con este recuento en vuelo, el diff que íbamos a grabar
	// sería contra la referencia vieja → 0 filas y se reintenta.
	const written = await executor
		.update(inventoryCountLines)
		.set({
			recountedStock: data.recountedStock,
			recountedById: data.userId,
			recountedAt: now,
			difference: recountDiff,
			adjustmentMovementId: diffChanges ? null : line.adjustmentMovementId,
			adjustmentCompleted: diffChanges ? false : line.adjustmentCompleted,
			adjustmentCompletedById: diffChanges ? null : line.adjustmentCompletedById,
			adjustmentCompletedAt: diffChanges ? null : line.adjustmentCompletedAt,
			// Un recuento que cambia la diferencia descarta la solicitud (habría
			// que re-solicitar con el diff nuevo).
			adjustmentReason: diffChanges ? null : line.adjustmentReason,
			adjustmentReasonText: diffChanges ? null : line.adjustmentReasonText,
			adjustmentRequestedBy: diffChanges ? null : line.adjustmentRequestedBy,
			adjustmentRequestedAt: diffChanges ? null : line.adjustmentRequestedAt,
			updatedAt: now
		})
		.where(
			and(
				eq(inventoryCountLines.id, line.id),
				eq(inventoryCountLines.systemStock, line.systemStock),
				sql`exists (
					select 1 from ${inventoryCountSessions}
					where ${inventoryCountSessions.id} = ${inventoryCountLines.sessionId}
						and ${inventoryCountSessions.status} = 'OPEN'
				)`
			)
		)
		.returning({ id: inventoryCountLines.id });
	if (written.length === 0) {
		const [fresh] = await executor
			.select({
				systemStock: inventoryCountLines.systemStock,
				countedStock: inventoryCountLines.countedStock,
				sessionStatus: inventoryCountSessions.status
			})
			.from(inventoryCountLines)
			.leftJoin(
				inventoryCountSessions,
				eq(inventoryCountLines.sessionId, inventoryCountSessions.id)
			)
			.where(eq(inventoryCountLines.id, line.id))
			.limit(1);
		if (fresh && fresh.sessionStatus === 'OPEN' && fresh.systemStock !== line.systemStock) {
			throw new Error(
				'El stock del sistema cambió mientras guardabas: la línea se recargó, revisa y guarda de nuevo'
			);
		}
		if (fresh && fresh.countedStock == null) {
			throw new Error('La línea aún no tiene un conteo que se pueda recontar');
		}
		throw new Error(
			'No se pudo guardar el recuento: la línea cambió, recarga e inténtalo de nuevo'
		);
	}

	const updated = await getLineById(line.id, executor);
	if (!updated) throw new Error('No se pudo recargar la línea recontada');
	return updated;
}

/** Confirmar en 0 todas las líneas de stock 0 sin contar (no bloquean el cierre). */
export async function confirmZeroStockBatch(
	sessionId: number,
	userId: string,
	executor: DbOrTx = db
): Promise<number> {
	const [session] = await executor
		.select()
		.from(inventoryCountSessions)
		.where(eq(inventoryCountSessions.id, sessionId))
		.limit(1);
	requireOpenSession(session ?? null);

	const now = new Date().toISOString();
	const updated = await executor
		.update(inventoryCountLines)
		.set({
			countedStock: 0,
			difference: 0,
			countedById: userId,
			countedAt: now,
			updatedAt: now
		})
		.where(
			and(
				eq(inventoryCountLines.sessionId, sessionId),
				eq(inventoryCountLines.systemStock, 0),
				sql`${inventoryCountLines.countedStock} is null`
			)
		)
		.returning({ id: inventoryCountLines.id });

	return updated.length;
}

export async function requireLineById(
	lineId: number,
	executor: DbOrTx
): Promise<InventoryCountLine> {
	const [line] = await executor
		.select()
		.from(inventoryCountLines)
		.where(eq(inventoryCountLines.id, lineId))
		.limit(1);
	if (!line) throw new Error('La línea de conteo no existe');
	return line;
}

/** Utilidad de diagnóstico: cuenta líneas por estado final (usada por informe legacy). */
export async function sessionFinalCounts(sessionId: number, executor: DbOrTx = db) {
	const [row] = await executor
		.select({
			total: sql<number>`count(*)`.mapWith(Number),
			verified: sql<number>`count(*) filter (where ${FINAL_COUNT_SQL} is not null)`.mapWith(Number),
			withDiff:
				sql<number>`count(*) filter (where ${FINAL_COUNT_SQL} is not null and ${FINAL_DIFF_SQL} != 0)`.mapWith(
					Number
				)
		})
		.from(inventoryCountLines)
		.where(eq(inventoryCountLines.sessionId, sessionId));
	return row;
}
