/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: internal helpers.
 */
import type { SaleFilterOptions } from './types';
import { eq, isNull, and, gte, lte, or, sql, type SQL, type SQLWrapper } from 'drizzle-orm';

import { buildTokenSearchConditions } from '$lib/server/db/search';

import { fromISODate, toEndOfDay, toUTCString } from '$lib/dates';
import { sales, saleItems, customers, users } from '$lib/server/db/schema';

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

/**
 * Build WHERE conditions from filter options.
 *
 * Defaults (no options): non-deleted sales only.
 *
 * NOTE: When using `search`, the query MUST include LEFT JOINs on
 * `customers` and `users` tables (as `getAllSales` does).
 */
function saleSearchConcat(): SQL {
	return sql`concat(coalesce(${customers.firstName}, ''), ' ', coalesce(${customers.lastName}, ''), ' ', coalesce(${customers.idNumber}, ''), ' ', coalesce(${users.fullName}, ''))`;
}

export function saleSearchFields(): SQLWrapper[] {
	return [customers.firstName, customers.lastName, customers.idNumber, users.fullName];
}

export function buildSaleConditions(opts: SaleFilterOptions): SQL | undefined {
	const conditions: SQL[] = [];

	if (!opts.includeDeleted) {
		conditions.push(isNull(sales.deletedAt));
	}

	if (opts.status) {
		conditions.push(eq(sales.status, opts.status));
	}

	if (opts.customerId) {
		conditions.push(eq(sales.customerId, opts.customerId));
	}

	if (opts.sellerId) {
		conditions.push(eq(sales.sellerId, opts.sellerId));
	}

	if (opts.dateFrom) {
		conditions.push(gte(sales.createdAt, opts.dateFrom));
	}

	if (opts.dateTo) {
		conditions.push(lte(sales.createdAt, toUTCString(toEndOfDay(fromISODate(opts.dateTo)!))));
	}

	if (opts.search) {
		const rawSearch = opts.search.trim();
		const tokenConditions = buildTokenSearchConditions(rawSearch, saleSearchConcat());
		const tokenGroup = tokenConditions.length > 0 ? and(...tokenConditions) : undefined;

		const normalizedOrderNumber = rawSearch.replace(/^#/, '');
		const orderNumberCondition = /^\d+$/.test(normalizedOrderNumber)
			? eq(sales.orderNumber, Number(normalizedOrderNumber))
			: undefined;

		if (tokenGroup && orderNumberCondition) {
			conditions.push(or(tokenGroup, orderNumberCondition)!);
		} else if (tokenGroup) {
			conditions.push(tokenGroup);
		} else if (orderNumberCondition) {
			conditions.push(orderNumberCondition);
		}
	}

	if (opts.shippingCostPending) {
		conditions.push(
			sql`exists (select 1 from ${saleItems} where ${saleItems.saleId} = ${sales.id} and ${saleItems.shippingCostPending} = true and ${saleItems.deletedAt} is null)`
		);
	}

	if (opts.hasFreeItem) {
		conditions.push(
			sql`exists (select 1 from ${saleItems} where ${saleItems.saleId} = ${sales.id} and ${saleItems.itemType} = 'FREE_ITEM' and ${saleItems.deletedAt} is null)`
		);
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}
