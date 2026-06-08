import type { PageServerLoad } from './$types';
import { getAllQuotes, countQuotes, getQuoteStats } from '$lib/server/db/queries/quotes';
import { monthStart, toUTCString } from '$lib/dates';
import { ALL_QUOTE_STATUSES, type QuoteStatus } from '$lib/shared/contracts/quotes';

export const load: PageServerLoad = async ({ url }) => {
	const searchParams = url.searchParams;
	const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
	const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
	const perPage = 10;
	const search = searchParams.get('q')?.trim() || undefined;
	const rawStatus = searchParams.get('status');
	const status =
		rawStatus && ALL_QUOTE_STATUSES.includes(rawStatus as QuoteStatus)
			? (rawStatus as QuoteStatus)
			: undefined;
	const offset = (page - 1) * perPage;

	const [initialQuotes, totalCount, stats] = await Promise.all([
		getAllQuotes({ limit: perPage, offset, search, status }),
		countQuotes({ search, status }),
		getQuoteStats(toUTCString(monthStart()))
	]);

	return {
		initialQuotes,
		totalCount,
		stats
	};
};
