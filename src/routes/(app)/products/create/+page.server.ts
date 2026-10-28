import type { PageServerLoad } from './$types';
import { getAllBrands } from '#lib/server/db/queries/brands.js';
import { getBrandSupplierMaps } from '#lib/server/db/queries/brandSuppliers.js';
import { getAllSuppliers } from '#lib/server/db/queries/suppliers.js';
import { getAllMaterials } from '#lib/server/db/queries/materials.js';
import { brands, suppliers, materials } from '#lib/server/db/schema/index.js';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';

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
