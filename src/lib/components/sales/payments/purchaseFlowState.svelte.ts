import type { EarlyPaymentDiscountSuggestion } from '$lib/shared/purchaseOrderCredit';
import type { PurchasePaymentPayload } from './purchasePayment';

/**
 * Purchase-only sub-machine: modals and early-payment benefit inputs.
 * Kept separate from the money math so the modal wiring has a single owner.
 */
export class PurchaseFlowState {
	showOverpaymentModal = $state(false);
	pendingAddPayload = $state<PurchasePaymentPayload | null>(null);
	showEarlyPaymentBenefitModal = $state(false);
	pendingBenefitSuggestion = $state<EarlyPaymentDiscountSuggestion | null>(null);
	benefitAmountInput = $state('');
	benefitNoteInput = $state('');

	reset = () => {
		this.showEarlyPaymentBenefitModal = false;
		this.pendingBenefitSuggestion = null;
		this.benefitAmountInput = '';
		this.benefitNoteInput = '';
	};
}
