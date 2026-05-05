import type { PageServerLoad } from './$types';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getBrandSupplierMaps } from '$lib/server/db/queries/brandSuppliers';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { getAllMaterials } from '$lib/server/db/queries/materials';
import { brands, suppliers, materials } from '$lib/server/db/schema';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);
	const [brandsList, suppliersList, materialsList, relationMaps] = await Promise.all([
		getAllBrands({ columns: { id: brands.id, name: brands.name } }),
		getAllSuppliers({ columns: { id: suppliers.id, name: suppliers.name } }),
		getAllMaterials({
			columns: {
				id: materials.id,
				name: materials.name,
				productType: materials.productType
			}
		}),
		getBrandSupplierMaps()
	]);

	return {
		brands: brandsList,
		suppliers: suppliersList,
		materials: materialsList,
		...relationMaps
	};
};
