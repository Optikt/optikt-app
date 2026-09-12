/**
 * Quotes remote — queries
 * Split from quotes.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { query } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { ListQuotesSchema, QuoteIdSchema } from '$lib/schemas/quotes';
import {
	getAllQuotes,
	countQuotes,
	getQuoteStats as getQuoteStatsQuery,
	findQuoteByIdWithRelations,
	getQuoteItemsWithDetails
} from '$lib/server/db/queries/quotes';
import type {
	QuoteWithRelations,
	QuoteItemWithDetails,
	QuoteStats
} from '$lib/server/db/queries/quotes';

import { monthStart, toUTCString } from '$lib/dates';

import { EmptySchema } from '$lib/schemas/common';

// ============================================================================
// TYPES
// ============================================================================

export interface PaginatedQuotes {
	quotes: QuoteWithRelations[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

export interface QuoteDetail {
	quote: QuoteWithRelations;
	items: QuoteItemWithDetails[];
}

export type { QuoteStats } from '$lib/server/db/queries/quotes';

// ============================================================================
// QUERIES
// ============================================================================

export const getQuoteStats = query(EmptySchema, async (): Promise<QuoteStats> => {
	requireAuth();

	return getQuoteStatsQuery(toUTCString(monthStart()));
});

/**
 * List quotes with pagination and filters
 */
export const listQuotes = query(ListQuotesSchema, async (data): Promise<PaginatedQuotes> => {
	requireAuth();

	const { page, perPage } = data;

	const filterOptions = {
		status: data.status ?? undefined,
		customerId: data.customerId ?? undefined,
		sellerId: data.sellerId ?? undefined,
		dateFrom: data.dateFrom ?? undefined,
		dateTo: data.dateTo ?? undefined,
		search: data.search ?? undefined
	};

	const [quotesPage, total] = await Promise.all([
		getAllQuotes({
			...filterOptions,
			limit: perPage,
			offset: (page - 1) * perPage
		}),
		countQuotes(filterOptions)
	]);

	const totalPages = Math.ceil(total / perPage);

	return { quotes: quotesPage, total, page, perPage, totalPages };
});

/**
 * Get full quote detail (quote + items)
 */
export const getQuoteDetail = query(QuoteIdSchema, async (data): Promise<QuoteDetail | null> => {
	requireAuth();

	const quoteWithRelations = await findQuoteByIdWithRelations(data.id);
	if (!quoteWithRelations) return null;

	const items = await getQuoteItemsWithDetails(data.id);

	return { quote: quoteWithRelations, items };
});
