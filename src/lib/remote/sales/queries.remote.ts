/**
 * Sales remote — queries
 * Split from sales.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import type { PaginatedSales, SaleDetail } from './shared';
import { query } from '$app/server';
import { requireAuth } from '$lib/server/guards';
import { ListSalesSchema, SaleIdSchema, CustomerLookupSchema } from '$lib/schemas/';
import {
	getAllSales,
	countSales,
	getSalesStats as getSalesStatsQuery,
	findSaleByIdWithRelations,
	getSaleItemsWithDetails,
	getSalePayments
} from '$lib/server/db/queries/sales';
import type { SalesStats } from '$lib/server/db/queries/';
import { findCustomerByIdNumber } from '$lib/server/db/queries/customers';

import { normalizeIdNumber } from '$lib/utils';

import { monthStart, toUTCString } from '$lib/dates';
import { EmptySchema } from '$lib/schemas/common';

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get aggregated sales stats (monthly, pending, completed, cancelled counts)
 */
export const getSalesStats = query(EmptySchema, async (): Promise<SalesStats> => {
	requireAuth();

	return getSalesStatsQuery(toUTCString(monthStart()));
});

/**
 * List sales with pagination and filters
 */
export const listSales = query(ListSalesSchema, async (data): Promise<PaginatedSales> => {
	requireAuth();

	const { page, perPage } = data;

	const filterOptions = {
		status: data.status ?? undefined,
		customerId: data.customerId ?? undefined,
		sellerId: data.sellerId ?? undefined,
		dateFrom: data.dateFrom ?? undefined,
		dateTo: data.dateTo ?? undefined,
		search: data.search ?? undefined,
		shippingCostPending: data.shippingCostPending ?? undefined,
		hasFreeItem: data.hasFreeItem ?? undefined
	};

	const [salesPage, total] = await Promise.all([
		getAllSales({
			...filterOptions,
			limit: perPage,
			offset: (page - 1) * perPage
		}),
		countSales(filterOptions)
	]);

	const totalPages = Math.ceil(total / perPage);

	return { sales: salesPage, total, page, perPage, totalPages };
});

/**
 * Get full sale detail (sale + items + payments)
 */
export const getSaleDetail = query(SaleIdSchema, async (data): Promise<SaleDetail | null> => {
	requireAuth();

	const saleWithRelations = await findSaleByIdWithRelations(data.id);
	if (!saleWithRelations) return null;

	const [items, payments] = await Promise.all([
		getSaleItemsWithDetails(data.id),
		getSalePayments(data.id, { includeVoided: true })
	]);

	return { sale: saleWithRelations, items, payments };
});

/**
 * Look up a customer by document ID (cédula/RIF)
 */
export const lookupCustomer = query(CustomerLookupSchema, async (data) => {
	requireAuth();

	const normalized = normalizeIdNumber(data.idNumber);
	const customer = await findCustomerByIdNumber(normalized);
	return { customer: customer ?? null };
});
