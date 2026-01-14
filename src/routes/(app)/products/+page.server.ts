import type { PageServerLoad } from './$types';
import { getAllProductsWithRelations } from '$lib/server/db/queries/products';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async () => {
	const [initialProducts, brands, suppliers] = await Promise.all([
		getAllProductsWithRelations(),
		getAllBrands(),
		getAllSuppliers()
	]);

	// Filter to active only for initial load
	const activeProducts = initialProducts.filter((p) => p.isActive);

	return {
		initialProducts: activeProducts.slice(0, 10),
		totalCount: activeProducts.length,
		brands: brands.map((b) => ({ id: b.id, name: b.name })),
		suppliers: suppliers.map((s) => ({ id: s.id, name: s.name }))
	};
};
