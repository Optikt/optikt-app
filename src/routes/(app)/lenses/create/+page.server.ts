import type { PageServerLoad } from './$types';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import { getAllLensMaterials } from '#lib/server/db/queries/lenses/materials.js';
import { getLensCatalogDistinctValues } from '#lib/server/db/queries/lenses/pending.js';
import { getAllSuppliers } from '#lib/server/db/queries/suppliers.js';

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
