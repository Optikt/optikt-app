import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import type { DbOrTx } from '$lib/server/db/types';
import { nowISO } from '$lib/dates';
import { quoteItems, quotes, type NewQuote, type Quote } from '$lib/server/db/schema';

/** Create a new quote. El número lo asigna la sequence de la DB. */
export async function createQuote(data: NewQuote, executor: DbOrTx = db): Promise<Quote> {
	const now = nowISO();
	const [quote] = await executor
		.insert(quotes)
		.values({
			...data,
			id: crypto.randomUUID(),
			createdAt: now,
			updatedAt: now
		})
		.returning();
	return quote;
}

/** Update a quote by ID. */
export async function updateQuote(
	id: string,
	data: Partial<Omit<Quote, 'id' | 'createdAt'>>,
	executor: DbOrTx = db
): Promise<Quote | null> {
	const [quote] = await executor
		.update(quotes)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(quotes.id, id))
		.returning();
	return quote ?? null;
}

/** Delete all items for a quote (used when updating items). */
export async function deleteQuoteItems(quoteId: string, executor: DbOrTx = db): Promise<void> {
	await executor.delete(quoteItems).where(eq(quoteItems.quoteId, quoteId));
}
