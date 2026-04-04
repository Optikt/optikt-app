import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const [suppliers, products] = await Promise.all([
		getAllSuppliers({ includeDeleted: false }),
		getAllProductsWithRelations({ includeInactive: false, limit: 500 })
	]);

	return {
		suppliers,
		products
	};
};
