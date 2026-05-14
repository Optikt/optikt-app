import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requirePageRole } from '$lib/server/guards';
import { UserRole } from '$lib/shared/enums';
import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';
import {
	findPurchaseOrderByIdWithRelations,
	getPurchaseOrderItems
} from '$lib/server/db/queries/purchaseOrders';
import { getPurchaseOrderPaymentsWithUsers } from '$lib/server/db/queries/purchaseOrderPayments';
import { getPurchaseOrderCreditSchedule } from '$lib/server/db/queries/purchaseOrderCreditSchedule';
import { getPurchaseOrderAuditHistory } from '$lib/server/db/queries/changeHistory';
import { getPurchaseOrderRelatedMovements } from '$lib/server/db/queries/inventoryMovements';
import { findLotById } from '$lib/server/db/queries/inventoryLots';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const purchaseOrder = await findPurchaseOrderByIdWithRelations(params.id);
	if (!purchaseOrder) {
		error(404, 'Orden de compra no encontrada');
	}

	const items = await getPurchaseOrderItems(params.id);

	// Load lots for items that have been confirmed (have lotId)
	const lotIds = items.map((item) => item.lotId).filter(Boolean) as string[];
	const [movements, lots, payments, creditSchedule, auditHistory] = await Promise.all([
		getPurchaseOrderRelatedMovements(params.id, lotIds),
		Promise.all(lotIds.map((id) => findLotById(id))),
		getPurchaseOrderPaymentsWithUsers(params.id, { includeVoided: true }),
		getPurchaseOrderCreditSchedule(params.id),
		getPurchaseOrderAuditHistory(params.id)
	]);
	const lotsMap = Object.fromEntries(lots.filter(Boolean).map((l) => [l!.id, l!]));
	const balance = computePurchaseOrderBalance(purchaseOrder, items, payments, creditSchedule);
	const dueStatus = getPurchaseOrderDueStatus({
		paymentTerms: purchaseOrder.paymentTerms,
		installments: creditSchedule,
		balance: balance.balance
	});

	return {
		purchaseOrder,
		items,
		payments,
		creditSchedule,
		balance,
		dueStatus,
		movements,
		lotsMap,
		auditHistory
	};
};
