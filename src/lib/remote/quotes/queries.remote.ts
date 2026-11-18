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
	countQuotesByStatus,
	sumQuotesForSelection,
	getQuoteStats as getQuoteStatsQuery
} from '$lib/server/db/queries/quotes/list';
import {
	findQuoteByIdWithRelations,
	getQuoteItemsWithDetails
} from '$lib/server/db/queries/quotes/reads';
import { getQuoteConversionPreview as getQuoteConversionPreviewQuery } from '$lib/server/db/queries/quotes/conversion';
import type {
	QuoteWithRelations,
	QuoteItemWithDetails,
	QuoteStats
} from '$lib/server/db/queries/quotes/types';
import type { QuoteConversionPreview } from '$lib/shared/quotes/conversionPreview';
import type { QuoteStatus } from '$lib/shared/contracts/quotes';

import { monthStart, toUTCString } from '$lib/dates';

import { EmptySchema } from '$lib/schemas/common/dates';

// ============================================================================
// TYPES
// ============================================================================

export interface PaginatedQuotes {
	quotes: QuoteWithRelations[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
	/** Suma de la selección completa (pie del listado). */
	selection: { count: number; totalUsd: number };
}

export interface QuoteFacets {
	counts: Record<QuoteStatus, number>;
}

export interface QuoteDetail {
	quote: QuoteWithRelations;
	items: QuoteItemWithDetails[];
}

export type { QuoteStats } from '$lib/server/db/queries/quotes/types';

// ============================================================================
// QUERIES
// ============================================================================

export const getQuoteStats = query(EmptySchema, async (): Promise<QuoteStats> => {
	requireAuth();

	return getQuoteStatsQuery(toUTCString(monthStart()));
});

/** Preview del próximo número (MAX+1, no reservante — puede cambiar al guardar). */
/** Preview de conversión (hero "Si se convierte hoy" + modal "Revisión"). */
export const getQuoteConversionPreview = query(
	QuoteIdSchema,
	async (data): Promise<QuoteConversionPreview | null> => {
		requireAuth();

		return getQuoteConversionPreviewQuery(data.id);
	}
);

/**
 * List quotes with pagination and filters
 */
export const listQuotes = query(ListQuotesSchema, async (data): Promise<PaginatedQuotes> => {
	requireAuth();

	const { page, perPage } = data;

	const filterOptions = {
		status: data.status ?? undefined,
		statuses: data.statuses ?? undefined,
		customerId: data.customerId ?? undefined,
		sellerId: data.sellerId ?? undefined,
		dateFrom: data.dateFrom ?? undefined,
		dateTo: data.dateTo ?? undefined,
		search: data.search ?? undefined,
		isCashea: data.isCashea ?? undefined
	};

	const orderBy =
		data.sort === 'total'
			? { orderBy: 'total' as const, orderSort: 'desc' as const }
			: data.sort === 'expiring'
				? { orderBy: 'validUntil' as const, orderSort: 'asc' as const }
				: { orderBy: 'quoteDate' as const, orderSort: 'desc' as const };

	const [quotesPage, total, selection] = await Promise.all([
		getAllQuotes({
			...filterOptions,
			...orderBy,
			limit: perPage,
			offset: (page - 1) * perPage
		}),
		countQuotes(filterOptions),
		sumQuotesForSelection(filterOptions)
	]);

	const totalPages = Math.ceil(total / perPage);

	return { quotes: quotesPage, total, page, perPage, totalPages, selection };
});

/**
 * Conteos por estado (pestañas del listado), respetando los demás filtros.
 */
export const getQuoteFacets = query(ListQuotesSchema, async (data): Promise<QuoteFacets> => {
	requireAuth();

	const counts = await countQuotesByStatus({
		customerId: data.customerId ?? undefined,
		sellerId: data.sellerId ?? undefined,
		dateFrom: data.dateFrom ?? undefined,
		dateTo: data.dateTo ?? undefined,
		search: data.search ?? undefined,
		isCashea: data.isCashea ?? undefined
	});
	return { counts };
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
