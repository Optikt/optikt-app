import type { PageServerLoad } from './$types';
import { getAllQuotes, countQuotes } from '$lib/server/db/queries/quotes';

export const load: PageServerLoad = async () => {
	const [initialQuotes, totalCount] = await Promise.all([
		getAllQuotes({ limit: 10 }),
		countQuotes()
	]);

	return {
		initialQuotes,
		totalCount
	};
};
