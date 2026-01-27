import type { PageServerLoad } from './$types';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async () => {
	const [brands, suppliers] = await Promise.all([getAllBrands(), getAllSuppliers()]);

	return {
		brands: brands.map((b) => ({ id: b.id, name: b.name })),
		suppliers: suppliers.map((s) => ({ id: s.id, name: s.name }))
	};
};
