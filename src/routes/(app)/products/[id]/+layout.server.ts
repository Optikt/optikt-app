import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { findProductByIdWithRelations } from '$lib/server/db/queries/products';
import { getAllBrands } from '$lib/server/db/queries/brands';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: LayoutServerLoad = async ({ params }) => {
	const product = await findProductByIdWithRelations(params.id);

	if (!product) {
		error(404, 'Producto no encontrado');
	}

	// Load brands and suppliers for edit form
	const [brands, suppliers] = await Promise.all([getAllBrands(), getAllSuppliers()]);

	return {
		product,
		brands: brands.map((b) => ({ id: b.id, name: b.name })),
		suppliers: suppliers.map((s) => ({ id: s.id, name: s.name }))
	};
};
