import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { suppliers } from '$lib/server/db/schema';
import { isNull, desc, count } from 'drizzle-orm';

/**
 * Load initial suppliers data for SSR
 * Only handles initial page load - filtering/pagination uses remote functions
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	// Get count
	const [countResult] = await db
		.select({ count: count() })
		.from(suppliers)
		.where(isNull(suppliers.deletedAt));

	// Get first page of suppliers
	const supplierList = await db
		.select({
			id: suppliers.id,
			name: suppliers.name,
			type: suppliers.type,
			rif: suppliers.rif,
			primaryPhone: suppliers.primaryPhone,
			email: suppliers.email,
			address: suppliers.address,
			instagram: suppliers.instagram,
			whatsapp: suppliers.whatsapp,
			website: suppliers.website,
			contactName: suppliers.contactName,
			contactPhone: suppliers.contactPhone,
			contactRole: suppliers.contactRole,
			notes: suppliers.notes,
			createdAt: suppliers.createdAt
		})
		.from(suppliers)
		.where(isNull(suppliers.deletedAt))
		.orderBy(desc(suppliers.createdAt))
		.limit(10);

	return {
		initialSuppliers: supplierList,
		totalCount: countResult?.count ?? 0
	};
};
