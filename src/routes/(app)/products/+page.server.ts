import type { PageServerLoad } from './$types';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { brands, suppliers } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const [initialProducts, brandsList, suppliersList] = await Promise.all([
		getAllProductsWithRelations({
			activeOnly: true,
			limit: 10,
			orderBy: 'createdAt',
			orderSort: 'desc'
		}),
		getAllBrands({ columns: { id: brands.id, name: brands.name } }),
		getAllSuppliers({ columns: { id: suppliers.id, name: suppliers.name } })
	]);

	return {
		initialProducts: initialProducts,
		totalCount: initialProducts.length,
		brands: brandsList,
		suppliers: suppliersList
	};
};
