import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { findProductByIdWithRelations } from '$lib/server/db/queries/products';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { getAllMaterials } from '$lib/server/db/queries/materials';
import { brands, suppliers, materials } from '$lib/server/db/schema';

export const load: LayoutServerLoad = async ({ params }) => {
	const product = await findProductByIdWithRelations(params.id);

	if (!product) {
		error(404, 'Producto no encontrado');
	}

	// Load brands, suppliers, and materials for edit form (only needed columns)
	const [brandsList, suppliersList, materialsList] = await Promise.all([
		getAllBrands({ id: brands.id, name: brands.name }),
		getAllSuppliers({ id: suppliers.id, name: suppliers.name }),
		getAllMaterials({
			id: materials.id,
			name: materials.name,
			productType: materials.productType
		})
	]);

	return {
		product,
		brands: brandsList,
		suppliers: suppliersList,
		materials: materialsList
	};
};
