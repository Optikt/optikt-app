import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { requirePageRole } from '#lib/server/guards.js';
import { UserRole } from '#lib/shared/enums/index.js';
import {
	computePurchaseOrderBalance,
	getPurchaseOrderDueStatus
} from '#lib/shared/purchaseOrderCredit.js';
import { getPurchaseOrderItems } from '#lib/server/db/queries/purchaseOrders/items.js';
import { findPurchaseOrderByIdWithRelations } from '#lib/server/db/queries/purchaseOrders/orders.js';
import { getPurchaseOrderPaymentsWithUsers } from '#lib/server/db/queries/purchaseOrderPayments.js';
import { getPurchaseOrderEarlyPaymentBenefits } from '#lib/server/db/queries/purchaseOrderEarlyPaymentBenefits.js';
import { getPurchaseOrderAuditHistory } from '#lib/server/db/queries/changeHistory.js';
import { getPurchaseOrderRelatedMovements } from '#lib/server/db/queries/inventoryMovements.js';
import { findLotById } from '#lib/server/db/queries/inventoryLots.js';

export const load: PageServerLoad = async ({ params, locals }) => {
	requirePageRole(locals, UserRole.ADMIN, UserRole.MANAGER);

	const purchaseOrder = await findPurchaseOrderByIdWithRelations(params.id);
	if (!purchaseOrder) {
		error(404, 'Orden de compra no encontrada');
	}

	const items = await getPurchaseOrderItems(params.id);

	// Load lots for items that have been confirmed (have lotId)
	const lotIds = items.map((item) => item.lotId).filter(Boolean) as string[];
	const [movements, lots, payments, earlyPaymentBenefits, auditHistory] = await Promise.all([
		getPurchaseOrderRelatedMovements(params.id, lotIds),
		Promise.all(lotIds.map((id) => findLotById(id))),
		getPurchaseOrderPaymentsWithUsers(params.id, { includeVoided: true }),
		getPurchaseOrderEarlyPaymentBenefits(params.id, { includeVoided: true }),
		getPurchaseOrderAuditHistory(params.id)
	]);
	const lotsMap = Object.fromEntries(lots.filter(Boolean).map((l) => [l!.id, l!]));
	const balance = computePurchaseOrderBalance(
		purchaseOrder,
		items,
		payments,
		earlyPaymentBenefits,
		{
			settlementCurrency: purchaseOrder.settlementCurrency,
			settlementGrossAmount: purchaseOrder.settlementGrossAmount,
			settlementDebtAmount: purchaseOrder.settlementDebtAmount
		}
	);
	const dueStatus = getPurchaseOrderDueStatus({
		paymentTerms: purchaseOrder.paymentTerms,
		creditDueDate: purchaseOrder.creditDueDate,
		earlyPaymentDiscountDeadline: purchaseOrder.earlyPaymentDiscountDeadline,
		balance: balance.settlementBalance
	});

	return {
		purchaseOrder,
		items,
		payments,
		earlyPaymentBenefits,
		balance,
		dueStatus,
		movements,
		lotsMap,
		auditHistory
	};
};
