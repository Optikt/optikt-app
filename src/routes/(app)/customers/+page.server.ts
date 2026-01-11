import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { customers } from '$lib/server/db/schema';
import { isNull, desc, count } from 'drizzle-orm';

/**
 * Load initial customers data for SSR
 * Only handles initial page load - filtering/pagination uses remote functions
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	// Get count
	const [countResult] = await db
		.select({ count: count() })
		.from(customers)
		.where(isNull(customers.deletedAt));

	// Get first page of customers
	const customerList = await db
		.select({
			id: customers.id,
			firstName: customers.firstName,
			lastName: customers.lastName,
			idNumber: customers.idNumber,
			birthDate: customers.birthDate,
			primaryPhone: customers.primaryPhone,
			email: customers.email,
			address: customers.address,
			secondaryPhones: customers.secondaryPhones,
			notes: customers.notes,
			createdAt: customers.createdAt,
			updatedAt: customers.updatedAt,
			deletedAt: customers.deletedAt
		})
		.from(customers)
		.where(isNull(customers.deletedAt))
		.orderBy(desc(customers.createdAt))
		.limit(10);

	return {
		initialCustomers: customerList,
		totalCount: countResult?.count ?? 0
	};
};
