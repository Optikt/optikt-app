import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';
import { getLensCatalogItemsWithRelations } from '$lib/server/db/queries/lenses';
import { getNextOrderNumber } from '$lib/server/db/queries/sales';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const [products, lensItems, nextOrderNumber, suppliers] = await Promise.all([
		getAllProductsWithRelations({ orderBy: 'name' }),
		getLensCatalogItemsWithRelations(),
		getNextOrderNumber(),
		getAllSuppliers({ orderBy: 'name' })
	]);

	return {
		products,
		lensItems,
		suppliers,
		nextOrderNumber,
		isAdmin: locals.user?.role === UserRole.ADMIN
	};
};
