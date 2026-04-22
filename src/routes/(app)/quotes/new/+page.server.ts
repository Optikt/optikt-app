import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';
import { getLensCatalogItemsWithRelations } from '$lib/server/db/queries/lenses';
import { getNextQuoteNumber } from '$lib/server/db/queries/quotes';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const [products, lensItems, nextQuoteNumber, suppliers] = await Promise.all([
		getAllProductsWithRelations({ orderBy: 'name' }),
		getLensCatalogItemsWithRelations(),
		getNextQuoteNumber(),
		getAllSuppliers({ orderBy: 'name' })
	]);

	return {
		products,
		lensItems,
		suppliers,
		nextQuoteNumber
	};
};
