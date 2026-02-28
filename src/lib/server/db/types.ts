import type { SelectedFields } from 'drizzle-orm/pg-core';

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
