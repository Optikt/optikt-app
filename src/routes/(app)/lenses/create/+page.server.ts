import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import { getAllLensMaterials, getLensCatalogDistinctValues } from '$lib/server/db/queries/lenses';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const [materials, suppliers, distinctValues] = await Promise.all([
		getAllLensMaterials(),
		getAllSuppliers({ orderBy: 'name' }),
		getLensCatalogDistinctValues()
	]);

	return {
		materials: materials.map((m) => ({
			id: m.id,
			name: m.name,
			refractiveIndex: m.refractiveIndex
		})),
		suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
		differentiators: distinctValues.differentiators
	};
};
