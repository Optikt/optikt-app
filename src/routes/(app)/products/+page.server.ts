import type { PageServerLoad } from './$types';
import { getAllProductsWithRelations, countProducts } from '$lib/server/db/queries/products';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { brands, suppliers } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const [initialProducts, totalCount, brandsList, suppliersList] = await Promise.all([
		getAllProductsWithRelations({
			limit: 10,
			orderBy: 'createdAt',
			orderSort: 'desc'
		}),
		countProducts(),
		getAllBrands({ columns: { id: brands.id, name: brands.name } }),
		getAllSuppliers({ columns: { id: suppliers.id, name: suppliers.name } })
	]);

	return {
		initialProducts,
		totalCount,
		brands: brandsList,
		suppliers: suppliersList
	};
};
