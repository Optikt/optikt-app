import type { PageServerLoad } from './$types';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import {
	getAllPurchaseOrders,
	countPurchaseOrders,
	getPurchaseOrderListStats
} from '$lib/server/db/queries/purchaseOrders';
import { getAllSuppliers } from '$lib/server/db/queries/suppliers';
import { PurchaseOrderStatus, PurchaseOrderUiState } from '$lib/shared/enums';

export const load: PageServerLoad = async ({ locals, url }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);
	const searchParams = url.searchParams;
	const rawPage = Number.parseInt(searchParams.get('page') ?? '1', 10);
	const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
	const perPage = 10;
	const search = searchParams.get('q')?.trim() || undefined;
	const supplierId = searchParams.get('supplier')?.trim() || undefined;
	const hasPendingBalance = searchParams.get('pending') === '1' ? true : undefined;
	const hasOverdueBalance = searchParams.get('overdue') === '1' ? true : undefined;

	type PurchaseOrderSortField = 'orderNumber' | 'orderDate' | 'createdAt' | 'status';
	type SortDirection = 'asc' | 'desc';
	const rawOrderBy = searchParams.get('orderBy');
	const orderBy: PurchaseOrderSortField =
		rawOrderBy === 'orderDate' ||
		rawOrderBy === 'createdAt' ||
		rawOrderBy === 'status' ||
		rawOrderBy === 'orderNumber'
			? rawOrderBy
			: 'orderNumber';
	const rawOrderSort = searchParams.get('orderSort');
	const orderSort: SortDirection =
		rawOrderSort === 'asc' || rawOrderSort === 'desc' ? rawOrderSort : 'desc';

	const rawStatus = searchParams.get('status');
	const isDraftInProgress = rawStatus === PurchaseOrderUiState.DRAFT_IN_PROGRESS;
	const isDraftReady = rawStatus === PurchaseOrderUiState.DRAFT_READY;
	const readyForReview = isDraftInProgress ? false : isDraftReady ? true : undefined;
	const status =
		rawStatus === PurchaseOrderStatus.DRAFT ||
		rawStatus === PurchaseOrderStatus.CONFIRMED ||
		rawStatus === PurchaseOrderStatus.CANCELLED ||
		isDraftInProgress ||
		isDraftReady
			? PurchaseOrderStatus.DRAFT === rawStatus || isDraftInProgress || isDraftReady
				? PurchaseOrderStatus.DRAFT
				: (rawStatus as PurchaseOrderStatus)
			: undefined;

	const offset = (page - 1) * perPage;

	const [initialPurchaseOrders, totalCount, suppliers, stats] = await Promise.all([
		getAllPurchaseOrders({
			limit: perPage,
			offset,
			search,
			status,
			readyForReview,
			supplierId,
			hasPendingBalance,
			hasOverdueBalance,
			orderBy,
			orderSort
		}),
		countPurchaseOrders({
			search,
			status,
			readyForReview,
			supplierId,
			hasPendingBalance,
			hasOverdueBalance
		}),
		getAllSuppliers({ includeDeleted: false }),
		getPurchaseOrderListStats()
	]);

	return {
		initialPurchaseOrders,
		totalCount,
		suppliers,
		stats
	};
};
