import type { PageServerLoad } from './$types';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { getAllProductsWithRelations } from '#lib/server/db/queries/products.js';
import { getLensCatalogItemsWithRelations } from '#lib/server/db/queries/lenses/catalog.js';
import { getNextQuoteNumber } from '#lib/server/db/queries/quotes.js';
import { getAllSuppliers } from '#lib/server/db/queries/suppliers.js';

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
