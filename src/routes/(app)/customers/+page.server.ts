import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllCustomers } from '$lib/server/db/queries/customers';
import { db } from '$lib/server/db';
import { customers, sales } from '$lib/server/db/schema';
import { isNull, count, countDistinct, gte, and, eq } from 'drizzle-orm';
import { monthStart, toUTCString } from '$lib/dates';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const searchParams = url.searchParams;
	const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
	const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
	const perPage = 10;
	const search = searchParams.get('q')?.trim().toLowerCase() ?? '';
	const includeDeleted = searchParams.get('deleted') === '1';

	const startOfMonth = toUTCString(monthStart());

	const [[newThisMonthResult], [pendingResult], allCustomers] = await Promise.all([
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
		getAllCustomers({
			includeDeleted,
			orderBy: 'createdAt',
			orderSort: 'desc'
		})
	]);

	const filteredCustomers = search
		? allCustomers.filter((customer) => {
				const firstName = customer.firstName.toLowerCase();
				const lastName = customer.lastName.toLowerCase();
				const idNumber = customer.idNumber?.toLowerCase() ?? '';
				const primaryPhone = customer.primaryPhone ?? '';
				const email = customer.email?.toLowerCase() ?? '';

				return (
					firstName.includes(search) ||
					lastName.includes(search) ||
					idNumber.includes(search) ||
					primaryPhone.includes(search) ||
					email.includes(search)
				);
			})
		: allCustomers;

	const totalCount = filteredCustomers.length;
	const offset = (page - 1) * perPage;
	const customerList = filteredCustomers.slice(offset, offset + perPage);

	return {
		initialCustomers: customerList,
		totalCount,
		newThisMonth: newThisMonthResult?.count ?? 0,
		pendingSalesCustomers: pendingResult?.count ?? 0
	};
};
