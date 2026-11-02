import { PurchasePaymentTerms } from '$lib/shared/enums';
import type { PurchaseOrder } from '$lib/server/db/schema';
import { getEarlyPaymentDiscountSuggestion } from '$lib/shared/purchaseOrderCredit';
import type { PaymentFormKind } from './paymentFormDerived';

export interface ProntoPagoInfo {
	percent: number;
	deadline: string;
	discountAmount: number;
	recommendedPayment: number;
	/** The form's payment date is still within the pronto pago window. */
	withinWindow: boolean;
}

/**
 * Pronto pago terms available on the order, regardless of the amount typed so
 * far. Used to render the "Aplicar pronto pago" button and the out-of-window
 * warning while registering a payment.
 */
export function computeProntoPagoInfo(args: {
	kind: PaymentFormKind;
	hasActiveEarlyPaymentBenefit: boolean;
	isFullyPaid?: boolean;
	pendingBalanceUsd?: number;
	debtTotalUsd?: number;
	purchaseOrder?: PurchaseOrder;
	paymentDate: string;
}): ProntoPagoInfo | null {
	const {
		kind,
		hasActiveEarlyPaymentBenefit,
		isFullyPaid,
		pendingBalanceUsd,
		debtTotalUsd,
		purchaseOrder,
		paymentDate
	} = args;
	if (kind !== 'purchase' || hasActiveEarlyPaymentBenefit || isFullyPaid) return null;
	if (pendingBalanceUsd == null || debtTotalUsd == null || !purchaseOrder) return null;
	if (purchaseOrder.paymentTerms !== PurchasePaymentTerms.CREDIT) return null;
	const percent = Number(purchaseOrder.earlyPaymentDiscountPercent ?? 0);
	const deadline = purchaseOrder.earlyPaymentDiscountDeadline;
	if (percent <= 0 || !deadline) return null;

	const currentBalance = Math.max(Number(pendingBalanceUsd || 0), 0);
	const discountAmount = Number(
		Math.min((Number(debtTotalUsd) * percent) / 100, currentBalance).toFixed(2)
	);
	const withinWindow = paymentDate.slice(0, 10) <= deadline;
	return {
		percent,
		deadline,
		discountAmount,
		recommendedPayment: Number(Math.max(currentBalance - discountAmount, 0).toFixed(2)),
		withinWindow
	};
}

export function computeLiveEarlyPaymentSuggestion(args: {
	kind: PaymentFormKind;
	hasActiveEarlyPaymentBenefit: boolean;
	pendingBalanceUsd?: number;
	debtTotalUsd?: number;
	purchaseOrder?: PurchaseOrder;
	paymentAmount: number;
	paymentDate: string;
}) {
	const {
		kind,
		hasActiveEarlyPaymentBenefit,
		pendingBalanceUsd,
		debtTotalUsd,
		purchaseOrder,
		paymentAmount,
		paymentDate
	} = args;
	return kind === 'purchase' &&
		!hasActiveEarlyPaymentBenefit &&
		pendingBalanceUsd != null &&
		debtTotalUsd != null &&
		purchaseOrder
		? getEarlyPaymentDiscountSuggestion({
				terms: purchaseOrder,
				totalDebt: debtTotalUsd,
				currentBalance: pendingBalanceUsd,
				paymentAmount,
				paymentDate
			})
		: null;
}
