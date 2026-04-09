import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllCustomers } from '$lib/server/db/queries/customers';
import { db } from '$lib/server/db';
import { customers, sales } from '$lib/server/db/schema';
import { isNull, count, countDistinct, gte, and, eq } from 'drizzle-orm';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const now = new Date();
	const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

	const [[countResult], [newThisMonthResult], [pendingResult], customerList] = await Promise.all([
		db.select({ count: count() }).from(customers).where(isNull(customers.deletedAt)),
		db
			.select({ count: count() })
			.from(customers)
			.where(and(isNull(customers.deletedAt), gte(customers.createdAt, startOfMonth))),
		db
			.select({ count: countDistinct(sales.customerId) })
			.from(sales)
			.innerJoin(customers, eq(sales.customerId, customers.id))
			.where(
				and(eq(sales.status, 'PENDING'), isNull(sales.deletedAt), isNull(customers.deletedAt))
			),
		getAllCustomers({ orderBy: 'createdAt', orderSort: 'desc', limit: 10 })
	]);

	return {
		initialCustomers: customerList,
		totalCount: countResult?.count ?? 0,
		newThisMonth: newThisMonthResult?.count ?? 0,
		pendingSalesCustomers: pendingResult?.count ?? 0
	};
};
