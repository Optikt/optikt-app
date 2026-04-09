import type { PageServerLoad } from './$types';
import { monthStart, toUTCString } from '$lib/dates';
import { SaleStatus } from '$lib/shared/enums';
import { getAllSales, countSales } from '$lib/server/db/queries/sales';

export const load: PageServerLoad = async () => {
	const monthStartIso = toUTCString(monthStart());

	const [
		initialSales,
		totalCount,
		monthlySalesCount,
		pendingSalesCount,
		completedSalesCount,
		cancelledSalesCount
	] = await Promise.all([
		getAllSales({ limit: 10 }),
		countSales(),
		countSales({ dateFrom: monthStartIso }),
		countSales({ status: SaleStatus.PENDING }),
		countSales({ status: SaleStatus.COMPLETED }),
		countSales({ status: SaleStatus.CANCELLED })
	]);

	return {
		initialSales,
		totalCount,
		monthlySalesCount,
		pendingSalesCount,
		completedSalesCount,
		cancelledSalesCount
	};
};
