/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: sale writes.
 */
import { eq } from 'drizzle-orm';

import { db } from '$lib/server/db';

import type { DbOrTx } from '$lib/server/db/types';
import { nowISO } from '$lib/dates';
import { sales, type Sale, type NewSale } from '$lib/server/db/schema';

/**
 * Create a new sale
 */
export async function createSale(data: NewSale): Promise<Sale> {
	const now = nowISO();
	const [sale] = await db
		.insert(sales)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return sale;
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
