import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getAllLensMaterials } from '$lib/server/db/queries/lenses';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const [materials, suppliers] = await Promise.all([getAllLensMaterials(), getAllSuppliers()]);

	return {
		materials: materials.map((m) => ({
			id: m.id,
			name: m.name,
			refractiveIndex: m.refractiveIndex
		})),
		suppliers: suppliers.map((s) => ({ id: s.id, name: s.name }))
	};
};
