import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { findLensCatalogItemByIdWithRelations } from '$lib/server/db/queries/lenses';
import { findAvailableSurplusByCatalogItemId } from '$lib/server/db/queries/surplusUnits';
import { isValidUuid } from '$lib/utils/uuid';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	if (!isValidUuid(params.id)) {
		error(404, 'Lente no encontrado');
	}

	const item = await findLensCatalogItemByIdWithRelations(params.id);

	if (!item) {
		error(404, 'Lente no encontrado');
	}

	// Surplus applies to non-LAB items (pair purchases where one unit is leftover)
	let surplusCount = 0;
	if (item.source !== 'LAB') {
		const surplusUnits = await findAvailableSurplusByCatalogItemId(item.id);
		surplusCount = surplusUnits.length;
	}

	return { item, surplusCount };
};
