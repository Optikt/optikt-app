/**
 * Quotes remote — create + update commands
 * Shell: auth + delegate. Logic lives in src/lib/server/quotes/.
 */
import { command } from '$app/server';
import { requireAuth } from '#lib/server/guards.js';
import { CreateQuoteSchema, UpdateQuoteSchema } from '#lib/schemas/quotes.js';
import { getActionContext } from '#lib/server/actionContext.js';
import { createNewQuoteCore } from '#lib/server/quotes/createNewQuote.js';
import { updateExistingQuoteCore } from '#lib/server/quotes/updateExistingQuote.js';

/**
 * Create a new quote with items in a single transaction.
 * No stock changes - quotes are informational until converted.
 */
export const createNewQuote = command(CreateQuoteSchema, async (data) => {
	const user = requireAuth();
	return createNewQuoteCore(data, getActionContext(user));
});

/**
 * Update a quote (only DRAFT quotes can be edited).
 * Replaces all items.
 */
export const updateExistingQuote = command(UpdateQuoteSchema, async (data) => {
	const user = requireAuth();
	return updateExistingQuoteCore(data, getActionContext(user));
});
