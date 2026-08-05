import { getContext, setContext } from 'svelte';
import type { PurchaseOrderSummary } from '$lib/components/purchases/purchaseOrderDraft';
import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
import type { PurchaseOrderPaymentWithUsers } from '$lib/server/db/queries/purchaseOrderPayments';
import type {
	PurchaseOrderItemWithProduct,
	PurchaseOrderWithRelations
} from '$lib/server/db/queries/purchaseOrders';
import type {
	PurchaseOrderBalanceSummary,
	PurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';

export type PurchaseOrderDetailContext = {
	purchaseOrder: () => PurchaseOrderWithRelations;
	items: () => PurchaseOrderItemWithProduct[];
	payments: () => PurchaseOrderPaymentWithUsers[];
	balance: () => PurchaseOrderBalanceSummary;
	dueStatus: () => PurchaseOrderDueStatus;
	auditHistory: () => ChangeHistoryWithUser[];
	isDraft: () => boolean;
	isReadyForReview: () => boolean;
	isConfirmed: () => boolean;
	isCancelled: () => boolean;
	canManagePayments: () => boolean;
	zeroPriceCount: () => number;
	purchaseSummary: () => PurchaseOrderSummary;
	totalUnits: () => number;
	totalPurchase: () => number;
	totalSale: () => number;
	totalProfit: () => number;
	netTotalPurchase: () => number;
	netTotalProfit: () => number;
	settlementDiscountAmount: () => number;
	hasSettlementDiscount: () => boolean;
	settlementDiscountLabel: () => string;
};

const PURCHASE_ORDER_DETAIL_CONTEXT_KEY = Symbol('purchaseOrderDetail');

/**
 * Set the purchase order detail context for child components.
 * Call this in the purchase order detail page after computing derived state.
 * Values are exposed as getter functions so consumers stay reactive when the
 * underlying $state/$derived is reassigned by the page.
 */
export function setPurchaseOrderDetailContext(context: PurchaseOrderDetailContext): void {
	setContext(PURCHASE_ORDER_DETAIL_CONTEXT_KEY, context);
}

/**
 * Get the purchase order detail context.
 * Call this in any child component that needs access to the purchase order
 * detail state. Returns getter functions — invoke them inside templates or
 * $derived expressions to stay reactive.
 */
export function getPurchaseOrderDetailContext(): PurchaseOrderDetailContext {
	const context = getContext<PurchaseOrderDetailContext>(PURCHASE_ORDER_DETAIL_CONTEXT_KEY);
	if (!context) {
		throw new Error(
			'PurchaseOrderDetail context not found. Make sure setPurchaseOrderDetailContext is called in a parent component.'
		);
	}
	return context;
}
