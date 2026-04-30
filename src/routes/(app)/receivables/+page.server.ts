import type { PageServerLoad } from './$types';
import { getReceivables } from '$lib/server/db/queries/receivables';
import { getLatestRates } from '$lib/server/db/queries/exchangeRates';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER, UserRole.SELLER);

	const [receivablesData, latestRates] = await Promise.all([
		getReceivables(),
		getLatestRates()
	]);

	const bcvRateEntry = latestRates.find((r) => r.currency.code === 'USD');
	const bcvRate = bcvRateEntry?.rateToVes ?? 0;

	return {
		...receivablesData,
		bcvRate
	};
};
