import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
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

	const items = await getQuoteItemsWithDetails(params.id);

	return {
		quote,
		items
	};
};
