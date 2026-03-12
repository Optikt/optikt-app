import type { PageServerLoad } from './$types';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';
import { getLensCatalogItemsWithRelations } from '$lib/server/db/queries/lenses';
import { getNextOrderNumber } from '$lib/server/db/queries/sales';

export const load: PageServerLoad = async () => {
	const [productsList, lensItemsList, nextOrderNumber] = await Promise.all([
		getAllProductsWithRelations({ orderBy: 'name' }),
		getLensCatalogItemsWithRelations(),
		getNextOrderNumber()
	]);

	return {
		products: productsList,
		lensItems: lensItemsList,
		nextOrderNumber
	};
};
