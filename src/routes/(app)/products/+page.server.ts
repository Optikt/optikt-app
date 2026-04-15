import type { PageServerLoad } from './$types';
import {
	getAllProductsWithRelations,
	countProducts,
	getProductInventoryStats
} from '$lib/server/db/queries/products';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { brands, suppliers } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const [initialProducts, totalCount, stats, brandsList, suppliersList] = await Promise.all([
		getAllProductsWithRelations({
			limit: 10,
			orderBy: 'createdAt',
			orderSort: 'desc'
		}),
		countProducts(),
		getProductInventoryStats(),
		getAllBrands({ columns: { id: brands.id, name: brands.name } }),
		getAllSuppliers({ columns: { id: suppliers.id, name: suppliers.name } })
	]);

	return {
		initialProducts,
		totalCount,
		stats,
		brands: brandsList,
		suppliers: suppliersList
	};
};
