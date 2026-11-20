/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: sale writes.
 */
import { eq, sql } from 'drizzle-orm';

import { db } from '$lib/server/db';

import type { DbOrTx } from '$lib/server/db/types';
import { nowISO } from '$lib/dates';
import { sales, type Sale, type NewSale } from '$lib/server/db/schema';

/** Postgres sequence that numbers sales (migration 0054). */
export const SALES_ORDER_NUMBER_SEQ = 'sales_order_number_seq';
const ORDER_NUMBER_UNIQUE_INDEX = 'ix_sales_order_number';
/** Max inserts an automatic sale tries when the next sequence value is already taken. */
const MAX_AUTO_NUMBER_ATTEMPTS = 5;

/** True when `err` (or its Drizzle `cause` chain) is a unique violation of `constraint`. */
function isUniqueViolation(err: unknown, constraint: string): boolean {
	let current: unknown = err;
	for (let depth = 0; current && depth < 5; depth++) {
		const e = current as { code?: string; constraint_name?: string; cause?: unknown };
		if (e.code === '23505' && e.constraint_name === constraint) return true;
		current = e.cause;
	}
	return false;
}

/** True when `err` is a duplicate `orderNumber` (unique `ix_sales_order_number`). */
export function isDuplicateOrderNumberError(err: unknown): boolean {
	return isUniqueViolation(err, ORDER_NUMBER_UNIQUE_INDEX);
}

/**
 * Create a new sale. Acepta `executor` para correr dentro de la tx del caller
 * (alta de venta, conversión de presupuesto).
 *
 * Numeración (ver docs/agents/sales.md → Numeración):
 * - **Automática** (`orderNumber` ausente): la asigna la sequence de la DB. Si el
 *   valor ya está ocupado por un número manual, reintenta (savepoint) con el
 *   siguiente `nextval`, hasta `MAX_AUTO_NUMBER_ATTEMPTS`.
 * - **Manual** (`orderNumber` presente, backfill/salto del ADMIN): se respeta tal
 *   cual; si ya existe lanza "El número de orden #N ya existe". Si el manual es
 *   ≥ al próximo automático, la sequence sube (`bumpSaleOrderSequence`) para
 *   que la siguiente automática sea N+1; un backfill menor no la mueve.
 */
export async function createSale(data: NewSale, executor: DbOrTx = db): Promise<Sale> {
	const now = nowISO();
	// createdAt: the caller may pass the business timestamp (alta: día del form + hora del submit)
	const values = {
		...data,
		id: crypto.randomUUID(),
		createdAt: data.createdAt ?? now,
		updatedAt: now
	};

	if (data.orderNumber != null) {
		const orderNumber = data.orderNumber;
		try {
			// Savepoint: a duplicate does not leave the caller's tx aborted.
			const sale = await executor.transaction(async (sp) => {
				const [row] = await sp.insert(sales).values(values).returning();
				return row;
			});
			await bumpSaleOrderSequence(orderNumber, executor);
			return sale;
		} catch (err) {
			if (isUniqueViolation(err, ORDER_NUMBER_UNIQUE_INDEX)) {
				throw new Error(`El número de orden #${orderNumber} ya existe`, { cause: err });
			}
			throw err;
		}
	}

	const { orderNumber: _omit, ...autoValues } = values;
	for (let attempt = 1; ; attempt++) {
		try {
			// Savepoint: a collision only rolls back this insert, not the caller's tx.
			// nextval() is not transactional, so the retry gets a fresh number.
			return await executor.transaction(async (sp) => {
				const [sale] = await sp.insert(sales).values(autoValues).returning();
				return sale;
			});
		} catch (err) {
			if (attempt < MAX_AUTO_NUMBER_ATTEMPTS && isUniqueViolation(err, ORDER_NUMBER_UNIQUE_INDEX)) {
				continue;
			}
			throw err;
		}
	}
}

/**
 * Sube la sequence de ventas si `orderNumber` es ≥ al próximo número automático,
 * para que la siguiente venta automática sea `orderNumber + 1`. Nunca la baja:
 * un backfill menor (ventas en papel cargadas después) no la toca y su hueco
 * queda libre. Llamar tras insertar/reasignar un número manual.
 *
 * Los bumps se serializan con un advisory lock de transacción: dos manuales en
 * paralelo (p. ej. #211 y #215) no pueden dejar la sequence en 211 tras haber
 * subido a 215. Ojo: `setval` NO es transaccional — si la tx del caller hace
 * rollback, la sequence queda subida y ese número queda como hueco (nunca duplica).
 */
export async function bumpSaleOrderSequence(
	orderNumber: number,
	executor: DbOrTx = db
): Promise<void> {
	await executor.transaction(async (t) => {
		await t.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${SALES_ORDER_NUMBER_SEQ}))`);
		await t.execute(sql`
			SELECT setval(${SALES_ORDER_NUMBER_SEQ}::regclass, ${orderNumber}::bigint, true)
			FROM ${sql.identifier(SALES_ORDER_NUMBER_SEQ)}
			WHERE ${orderNumber}::bigint >= CASE WHEN is_called THEN last_value + 1 ELSE last_value END
		`);
	});
}

/**
 * Update a sale by ID
 */
export async function updateSale(
	id: string,
	data: Partial<Omit<Sale, 'id' | 'createdAt'>>,
	executor: DbOrTx = db
): Promise<Sale | null> {
	const [sale] = await executor
		.update(sales)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(sales.id, id))
		.returning();
	return sale ?? null;
}
