import type { PageServerLoad } from './$types';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';
import { getLensCatalogItemsWithRelations } from '$lib/server/db/queries/lenses';
import { getNextQuoteNumber } from '$lib/server/db/queries/quotes';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async () => {
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
