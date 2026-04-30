import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getSettings } from '$lib/server/db/queries/settings';
import {
	findQuoteByIdWithRelations,
	getQuoteItemsWithDetails
} from '$lib/server/db/queries/quotes';

export const load: PageServerLoad = async ({ params, locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const quote = await findQuoteByIdWithRelations(params.id);
	if (!quote) {
		error(404, 'Presupuesto no encontrado');
	}

	const [items, settings] = await Promise.all([getQuoteItemsWithDetails(params.id), getSettings()]);

	return {
		items,
		quote,
		settings
	};
};
