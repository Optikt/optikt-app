import type { PageServerLoad } from './$types';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { getAllMaterials } from '$lib/server/db/queries/materials';
import { brands, suppliers, materials } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const [brandsList, suppliersList, materialsList] = await Promise.all([
		getAllBrands({ columns: { id: brands.id, name: brands.name } }),
		getAllSuppliers({ columns: { id: suppliers.id, name: suppliers.name } }),
		getAllMaterials({
			columns: {
				id: materials.id,
				name: materials.name,
				productType: materials.productType
			}
		})
	]);

	return {
		brands: brandsList,
		suppliers: suppliersList,
		materials: materialsList
	};
};
