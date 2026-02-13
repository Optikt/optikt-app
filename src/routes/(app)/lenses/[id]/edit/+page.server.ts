import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { findLensCatalogItemById, getAllLensMaterials } from '$lib/server/db/queries/lenses';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const [item, materials, suppliers] = await Promise.all([
		findLensCatalogItemById(params.id),
		getAllLensMaterials(),
		getAllSuppliers()
	]);

	if (!item) {
		error(404, 'Lente no encontrado');
	}

	return {
		item,
		ranges: item.ranges,
		materials: materials.map((m) => ({
			id: m.id,
			name: m.name,
			refractiveIndex: m.refractiveIndex
		})),
		suppliers: suppliers.map((s) => ({ id: s.id, name: s.name }))
	};
};
