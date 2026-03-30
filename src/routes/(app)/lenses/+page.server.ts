import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getAllLensMaterials,
	getLensCatalogItemsWithRelations
} from '$lib/server/db/queries/lenses';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const [materials, catalogItems, suppliers] = await Promise.all([
		getAllLensMaterials(),
		getLensCatalogItemsWithRelations(),
		getAllSuppliers()
	]);

	return {
		materials,
		catalogItems,
		suppliers: suppliers.map((s) => ({ id: s.id, name: s.name }))
	};
};
