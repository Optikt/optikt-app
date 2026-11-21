/**
 * Quotes remote — create + update commands
 * Shell: auth + delegate. Logic lives in src/lib/server/quotes/.
 */
import { command } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import {
	CreateQuoteSchema,
	SaveQuoteItemGroupsSchema,
	UpdateQuoteSchema
} from '$lib/schemas/quotes';
import { getActionContext } from '$lib/server/actionContext';
import { createNewQuoteCore } from '$lib/server/quotes/createNewQuote';
import { updateExistingQuoteCore } from '$lib/server/quotes/updateExistingQuote';
import { saveQuoteItemGroupsCore } from '$lib/server/quotes/saveQuoteItemGroups';

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

/** Groups-only save (per-person grouping) from the quote detail. DRAFT only. */
export const saveQuoteItemGroups = command(SaveQuoteItemGroupsSchema, async (data) => {
	const user = requireAuth();
	return saveQuoteItemGroupsCore(data, getActionContext(user));
});
