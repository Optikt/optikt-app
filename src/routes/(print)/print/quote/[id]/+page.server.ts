import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSettings } from '$lib/server/db/queries/settings';
import { findQuoteItemGroups } from '$lib/server/db/queries/quotes/itemGroups';
import { orderLinesByGroups } from '$lib/shared/saleItemGroups';
import {
	findQuoteByIdWithRelations,
	getQuoteItemsWithDetails
} from '$lib/server/db/queries/quotes/reads';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const quote = await findQuoteByIdWithRelations(params.id);
	if (!quote) {
		error(404, 'Presupuesto no encontrado');
	}

	const [rawItems, settings, groups] = await Promise.all([
		getQuoteItemsWithDetails(params.id),
		getSettings(),
		findQuoteItemGroups(params.id)
	]);
	// Lines of each person together (names are not printed).
	const items = orderLinesByGroups(rawItems, groups, (i) => i.parentQuoteItemId);

	return {
		items,
		quote,
		settings
	};
};
