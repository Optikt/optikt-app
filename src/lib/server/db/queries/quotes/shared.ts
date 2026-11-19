/** Condiciones y helpers de búsqueda compartidos por los módulos de queries de quotes. */
import { and, eq, gte, inArray, isNull, lte, sql, type SQL, type SQLWrapper } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { buildTokenSearchConditions } from '$lib/server/db/search';
import { fromISODate, toEndOfDay, toUTCString } from '$lib/dates';
import { customers, quotes, sales, users } from '$lib/server/db/schema';
import type { QuoteFilterOptions } from './types';

function quoteSearchConcat(): SQL {
	return sql`concat(coalesce(${customers.firstName}, ''), ' ', coalesce(${customers.lastName}, ''), ' ', coalesce(${customers.idNumber}, ''), ' ', coalesce(${users.fullName}, ''))`;
}

export function quoteSearchFields(): SQLWrapper[] {
	return [customers.firstName, customers.lastName, customers.idNumber, users.fullName];
}

export function buildQuoteConditions(opts: QuoteFilterOptions): SQL | undefined {
	const conditions: SQL[] = [];

	if (!opts.includeDeleted) {
		conditions.push(isNull(quotes.deletedAt));
	}

	if (opts.statuses && opts.statuses.length > 0) {
		conditions.push(inArray(quotes.status, opts.statuses));
	} else if (opts.status) {
		conditions.push(eq(quotes.status, opts.status));
	}

	if (opts.customerId) {
		conditions.push(eq(quotes.customerId, opts.customerId));
	}

	if (opts.sellerId) {
		conditions.push(eq(quotes.sellerId, opts.sellerId));
	}

	if (opts.isCashea !== undefined) {
		conditions.push(eq(quotes.isCashea, opts.isCashea));
	}

	if (opts.dateFrom) {
		conditions.push(gte(quotes.quoteDate, opts.dateFrom));
	}

	if (opts.dateTo) {
		conditions.push(lte(quotes.quoteDate, toUTCString(toEndOfDay(fromISODate(opts.dateTo)!))));
	}

	if (opts.search) {
		conditions.push(...buildTokenSearchConditions(opts.search, quoteSearchConcat()));
	}

	return conditions.length > 0 ? and(...conditions) : undefined;
}

/** Base con los joins que necesitan el filtro de búsqueda y el número de venta. */
export function quoteListBase() {
	return db
		.select({
			quote: quotes,
			customer: {
				id: customers.id,
				firstName: customers.firstName,
				lastName: customers.lastName,
				idNumber: customers.idNumber,
				birthDate: customers.birthDate,
				primaryPhone: customers.primaryPhone,
				gender: customers.gender,
				address: customers.address
			},
			seller: { id: users.id, fullName: users.fullName },
			convertedOrderNumber: sales.orderNumber
		})
		.from(quotes)
		.leftJoin(customers, eq(quotes.customerId, customers.id))
		.leftJoin(users, eq(quotes.sellerId, users.id))
		.leftJoin(sales, eq(quotes.conversionSaleId, sales.id))
		.$dynamic();
}
