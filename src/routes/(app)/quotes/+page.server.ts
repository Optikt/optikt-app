import type { PageServerLoad } from './$types';
import { getAllQuotes, countQuotes, getQuoteStats } from '$lib/server/db/queries/quotes';
import { monthStart, toUTCString } from '$lib/dates';

export const load: PageServerLoad = async () => {
	const [initialQuotes, totalCount, stats] = await Promise.all([
		getAllQuotes({ limit: 10 }),
		countQuotes(),
		getQuoteStats(toUTCString(monthStart()))
	]);

	return {
		initialQuotes,
		totalCount,
		stats
	};
};
