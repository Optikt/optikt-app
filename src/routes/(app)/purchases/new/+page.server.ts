import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getLensCatalogItemsWithRelations } from '$lib/server/db/queries/lenses';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const [suppliers, products, lensItems] = await Promise.all([
		getAllSuppliers({ includeDeleted: false }),
		getAllProductsWithRelations({ includeInactive: false, limit: 500 }),
		getLensCatalogItemsWithRelations()
	]);

	return {
		suppliers,
		products,
		lensItems
	};
};
