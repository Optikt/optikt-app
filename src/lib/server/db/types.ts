import type { SelectedFields } from 'drizzle-orm/pg-core';
import type { db } from './index';

type TxParam = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Drizzle database or transaction instance.
 *
 * Query functions accept this type so they work both standalone (using `db`)
 * and inside transactions (using `tx`). The caller decides atomicity:
 *
 * @example
 * // Standalone - uses db internally
 * await addSalePayment(data);
 *
 * // Inside a transaction
 * await db.transaction(async (tx) => {
 *   await addSalePayment(data, tx);
 *   await recalcSalePaidAmount(saleId, tx);
 * });
 */
export type DbOrTx = typeof db | TxParam;

/**
 * Infer the row type from a Drizzle `SelectedFields` object.
 *
 * Maps each selected column to its runtime data type, giving you a typed
 * row that matches only the projected columns.
 *
 * @example
 * type Row = InferSelectedRow<{ id: typeof brands.id; name: typeof brands.name }>;
 * // { id: string; name: string }
 */
export type InferSelectedRow<T extends SelectedFields> = {
	[K in keyof T]: T[K] extends { _: { data: infer D } } ? D : never;
};
