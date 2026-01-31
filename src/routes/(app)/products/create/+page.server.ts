import type { PageServerLoad } from './$types';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { getAllMaterials } from '$lib/server/db/queries/materials';

export const load: PageServerLoad = async () => {
	const [brands, suppliers, materials] = await Promise.all([
		getAllBrands(),
		getAllSuppliers(),
		getAllMaterials()
	]);

	return {
		brands: brands.map((b) => ({ id: b.id, name: b.name })),
		suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
		materials: materials.map((m) => ({ id: m.id, name: m.name, productType: m.productType }))
	};
};
