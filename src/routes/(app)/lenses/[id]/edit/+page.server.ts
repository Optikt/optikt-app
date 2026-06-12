import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import {
	findLensCatalogItemById,
	getAllLensMaterials,
	getLensCatalogDistinctValues,
	getTechnologiesBySupplier,
	findLensTechnologyById
} from '$lib/server/db/queries/lenses';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const [item, materials, suppliers, distinctValues] = await Promise.all([
		findLensCatalogItemById(params.id),
		getAllLensMaterials(),
		getAllSuppliers({ orderBy: 'name' }),
		getLensCatalogDistinctValues()
	]);

	if (!item) {
		error(404, 'Lente no encontrado');
	}

	const supplierTechnologies =
		item.supplierId && !item.supplierId.startsWith('pending_')
			? await getTechnologiesBySupplier(item.supplierId, item.technologyId ?? undefined)
			: [];

	// Determine if the current technology is global (no supplier)
	const currentTech = item.technologyId ? await findLensTechnologyById(item.technologyId) : null;
	const technologyIsGlobal = currentTech?.supplierId === null;

	return {
		item,
		ranges: item.ranges,
		materials: materials.map((m) => ({
			id: m.id,
			name: m.name,
			refractiveIndex: m.refractiveIndex
		})),
		suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
		technologies: distinctValues.technologies,
		differentiators: distinctValues.differentiators,
		supplierTechnologies: supplierTechnologies.map((t) => ({ id: t.id, name: t.name })),
		technologyIsGlobal
	};
};
