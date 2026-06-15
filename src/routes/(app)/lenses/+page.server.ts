import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import {
	getAllLensMaterials,
	getLensCatalogDistinctValues,
	getLensCatalogItemsWithRelations,
	getAllTechnologies,
	getAllDifferentiators
} from '$lib/server/db/queries/lenses';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import {
	ALL_LENS_SOURCES,
	ALL_LENS_TYPES,
	type LensCatalogSource,
	type LensType
} from '$lib/shared/enums';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const searchParams = url.searchParams;
	const search = searchParams.get('q')?.trim() || undefined;
	const rawSource = searchParams.get('source');
	const source =
		rawSource && ALL_LENS_SOURCES.includes(rawSource as LensCatalogSource)
			? (rawSource as LensCatalogSource)
			: undefined;
	const rawType = searchParams.get('type');
	const type =
		rawType && ALL_LENS_TYPES.includes(rawType as LensType) ? (rawType as LensType) : undefined;
	const supplierId = searchParams.get('supplier')?.trim() || undefined;
	const materialId = searchParams.get('material')?.trim() || undefined;
	const technology = searchParams.get('technology')?.trim() || undefined;
	const differentiator = searchParams.get('differentiator')?.trim() || undefined;

	const [materials, catalogItems, distinctValues, suppliers, allTechnologies, allDifferentiators] =
		await Promise.all([
			getAllLensMaterials(),
			getLensCatalogItemsWithRelations({
				search,
				source,
				type,
				supplierId,
				materialId,
				technologyId: technology,
				differentiator
			}),
			getLensCatalogDistinctValues(),
			getAllSuppliers({ orderBy: 'name' }),
			getAllTechnologies(),
			getAllDifferentiators()
		]);

	return {
		materials,
		catalogItems,
		allTechnologies,
		allDifferentiators,
		technologies: distinctValues.technologies,
		differentiators: distinctValues.differentiators,
		suppliers: suppliers.map((s) => ({ id: s.id, name: s.name }))
	};
};
