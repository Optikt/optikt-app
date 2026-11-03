import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CurrencyCode, PaymentMethod, PurchasePaymentTerms } from '$lib/shared/enums';
import type { PurchaseOrder } from '$lib/server/db/schema';
import {
	computeAmountAppliedToDebt,
	computeDeliveryAmountForAppliedDebt,
	maybeSubmitPurchase,
	submitPurchasePayment,
	submitPaymentWithBenefit,
	type PurchaseFlowState,
	type PurchaseFlowMutations
} from './purchasePayment';
import { computeProntoPagoInfo } from './purchaseOrderProntoPago';

vi.mock('svelte-sonner', () => ({
	toast: { success: vi.fn(), error: vi.fn() }
}));

const addPaymentCmd = vi.hoisted(() => vi.fn());
vi.mock('$lib/remote/purchaseOrders/payments.remote', () => ({
	addPurchaseOrderPaymentCmd: addPaymentCmd
}));

describe('computeAmountAppliedToDebt', () => {
	it('returns undefined for USD-BCV settlement or missing rate', () => {
		expect(
			computeAmountAppliedToDebt({
				isNativeSettlement: false,
				purchaseNormalizedAmountBs: 100,
				settlementRateToVes: 40
			})
		).toBeUndefined();
		expect(
			computeAmountAppliedToDebt({
				isNativeSettlement: true,
				purchaseNormalizedAmountBs: 100,
				settlementRateToVes: 0
			})
		).toBeUndefined();
	});

	it('divides the delivered Bs by the settlement rate', () => {
		expect(
			computeAmountAppliedToDebt({
				isNativeSettlement: true,
				purchaseNormalizedAmountBs: 5800,
				settlementRateToVes: 5800
			})
		).toBe(1);
	});
});

describe('computeDeliveryAmountForAppliedDebt', () => {
	it('returns the applied debt times the settlement rate for Bs rails', () => {
		expect(
			computeDeliveryAmountForAppliedDebt({
				railCurrency: CurrencyCode.VES,
				appliedDebt: 100,
				settlementRateToVes: 40,
				bcvRate: 40,
				specificRateValue: 0
			})
		).toBe(4000);
	});

	it('returns the applied debt when the rail delivers the settlement currency', () => {
		expect(
			computeDeliveryAmountForAppliedDebt({
				railCurrency: CurrencyCode.EUR_BCV,
				appliedDebt: 100,
				settlementRateToVes: 5800,
				bcvRate: 40,
				specificRateValue: 5800
			})
		).toBe(100);
	});

	it('converts through Bs ÷ BCV for USDT-style USD delivery', () => {
		expect(
			computeDeliveryAmountForAppliedDebt({
				railCurrency: CurrencyCode.USD_BCV,
				appliedDebt: 100,
				settlementRateToVes: 5800,
				bcvRate: 40,
				specificRateValue: 5800
			})
		).toBe(14500);
	});

	it('scales with the rail-specific rate for foreign rails', () => {
		expect(
			computeDeliveryAmountForAppliedDebt({
				railCurrency: CurrencyCode.USDT,
				appliedDebt: 100,
				settlementRateToVes: 5800,
				bcvRate: 40,
				specificRateValue: 290
			})
		).toBe(2000);
	});

	it('guards against missing rates and non-positive inputs', () => {
		expect(
			computeDeliveryAmountForAppliedDebt({
				railCurrency: CurrencyCode.EUR_BCV,
				appliedDebt: 100,
				settlementRateToVes: 0,
				bcvRate: 40,
				specificRateValue: 5800
			})
		).toBe(0);
		expect(
			computeDeliveryAmountForAppliedDebt({
				railCurrency: CurrencyCode.EUR_BCV,
				appliedDebt: 0,
				settlementRateToVes: 5800,
				bcvRate: 40,
				specificRateValue: 5800
			})
		).toBe(0);
		expect(
			computeDeliveryAmountForAppliedDebt({
				railCurrency: CurrencyCode.USD_BCV,
				appliedDebt: 100,
				settlementRateToVes: 40,
				bcvRate: 0,
				specificRateValue: 0
			})
		).toBe(0);
		expect(
			computeDeliveryAmountForAppliedDebt({
				railCurrency: CurrencyCode.USDT,
				appliedDebt: 100,
				settlementRateToVes: 40,
				bcvRate: 40,
				specificRateValue: 0
			})
		).toBe(0);
	});
});

function purchaseOrder(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
	return {
		paymentTerms: PurchasePaymentTerms.CREDIT,
		earlyPaymentDiscountPercent: 5,
		earlyPaymentDiscountDeadline: '2026-10-11',
		...overrides
	} as unknown as PurchaseOrder;
}

describe('computeProntoPagoInfo', () => {
	it('returns null outside the purchase credit-pronto-pago context', () => {
		expect(
			computeProntoPagoInfo({
				kind: 'sale',
				hasActiveEarlyPaymentBenefit: false,
				pendingBalanceUsd: 100,
				debtTotalUsd: 200,
				purchaseOrder: purchaseOrder(),
				paymentDate: '2026-10-01'
			})
		).toBeNull();
		expect(
			computeProntoPagoInfo({
				kind: 'purchase',
				hasActiveEarlyPaymentBenefit: true,
				pendingBalanceUsd: 100,
				debtTotalUsd: 200,
				purchaseOrder: purchaseOrder(),
				paymentDate: '2026-10-01'
			})
		).toBeNull();
		expect(
			computeProntoPagoInfo({
				kind: 'purchase',
				hasActiveEarlyPaymentBenefit: false,
				isFullyPaid: true,
				pendingBalanceUsd: 0,
				debtTotalUsd: 200,
				purchaseOrder: purchaseOrder(),
				paymentDate: '2026-10-01'
			})
		).toBeNull();
		expect(
			computeProntoPagoInfo({
				kind: 'purchase',
				hasActiveEarlyPaymentBenefit: false,
				pendingBalanceUsd: 100,
				debtTotalUsd: 200,
				purchaseOrder: purchaseOrder({ paymentTerms: PurchasePaymentTerms.CONTADO }),
				paymentDate: '2026-10-01'
			})
		).toBeNull();
		expect(
			computeProntoPagoInfo({
				kind: 'purchase',
				hasActiveEarlyPaymentBenefit: false,
				pendingBalanceUsd: 100,
				debtTotalUsd: 200,
				purchaseOrder: purchaseOrder({ earlyPaymentDiscountPercent: 0 }),
				paymentDate: '2026-10-01'
			})
		).toBeNull();
	});

	it('preloads the net payment inside the window, capped to the balance', () => {
		const info = computeProntoPagoInfo({
			kind: 'purchase',
			hasActiveEarlyPaymentBenefit: false,
			pendingBalanceUsd: 100,
			debtTotalUsd: 200,
			purchaseOrder: purchaseOrder(),
			paymentDate: '2026-10-09'
		});
		expect(info).not.toBeNull();
		expect(info!.discountAmount).toBe(10);
		expect(info!.recommendedPayment).toBe(90);
		expect(info!.withinWindow).toBe(true);

		const partialBalance = computeProntoPagoInfo({
			kind: 'purchase',
			hasActiveEarlyPaymentBenefit: false,
			pendingBalanceUsd: 5,
			debtTotalUsd: 200,
			purchaseOrder: purchaseOrder(),
			paymentDate: '2026-10-09'
		});
		expect(partialBalance!.discountAmount).toBe(5);
		expect(partialBalance!.recommendedPayment).toBe(0);
	});

	it('flags an out-of-window payment date', () => {
		const info = computeProntoPagoInfo({
			kind: 'purchase',
			hasActiveEarlyPaymentBenefit: false,
			pendingBalanceUsd: 100,
			debtTotalUsd: 200,
			purchaseOrder: purchaseOrder(),
			paymentDate: '2026-10-15'
		});
		expect(info!.withinWindow).toBe(false);
	});
});

function mutations(): PurchaseFlowMutations {
	return {
		setSubmitting: vi.fn(),
		onFinanceChanged: vi.fn(),
		partialReset: vi.fn(),
		setPendingAddPayload: vi.fn(),
		setShowOverpaymentModal: vi.fn(),
		setPendingBenefitSuggestion: vi.fn(),
		setBenefitAmountInput: vi.fn(),
		setBenefitNoteInput: vi.fn(),
		setShowEarlyPaymentBenefitModal: vi.fn(),
		resetEarlyPaymentState: vi.fn()
	};
}

function flowState(overrides: Partial<PurchaseFlowState> = {}): PurchaseFlowState {
	return {
		pendingBalanceUsd: 100,
		resolvedAmountUsd: 0,
		purchaseCurrencyCode: CurrencyCode.USD_BCV,
		liveEarlyPaymentSuggestion: null,
		pendingAddPayload: null,
		pendingBenefitSuggestion: null,
		benefitAmountInput: '',
		benefitNoteInput: '',
		isNativeSettlement: false,
		activeBcvRate: 40,
		needsSpecificRate: false,
		specificRateValue: 0,
		settlementRateToVes: 40,
		settlementDebtAmount: 200,
		settlementDebtAmountUsdBcvAtOrder: 200,
		comparisonAmount: 0,
		...overrides
	};
}

describe('maybeSubmitPurchase', () => {
	it('opens the overpayment modal instead of submitting', async () => {
		const mut = mutations();
		const payload = { purchaseOrderId: 'po-1', paymentMethod: PaymentMethod.EFECTIVO_BS };

		await maybeSubmitPurchase(
			payload as never,
			flowState({ comparisonAmount: 150, resolvedAmountUsd: 150 }),
			mut
		);

		expect(mut.setShowOverpaymentModal).toHaveBeenCalledWith(true);
		expect(mut.setPendingAddPayload).toHaveBeenCalledWith(payload);
		expect(mut.setSubmitting).not.toHaveBeenCalled();
	});

	it('opens the benefit modal when a live pronto pago suggestion exists', async () => {
		const mut = mutations();
		const suggestion = {
			amount: 5,
			percent: 5,
			deadline: '2026-10-11',
			currentBalance: 100,
			recommendedPayment: 95,
			overpayment: 0,
			residualAfterPayment: 0
		};

		await maybeSubmitPurchase(
			{} as never,
			flowState({
				comparisonAmount: 95,
				liveEarlyPaymentSuggestion: suggestion as never,
				needsSpecificRate: true
			}),
			mut
		);

		expect(mut.setShowEarlyPaymentBenefitModal).toHaveBeenCalledWith(true);
		expect(mut.setBenefitAmountInput).toHaveBeenCalledWith('5.00');
		expect(mut.setSubmitting).not.toHaveBeenCalled();
	});

	it('submits directly when there is no overpayment nor benefit suggestion', async () => {
		addPaymentCmd.mockResolvedValueOnce({ success: true });
		const mut = mutations();

		await maybeSubmitPurchase(
			{ purchaseOrderId: 'po-1' } as never,
			flowState({ pendingBalanceUsd: undefined }),
			mut
		);

		expect(addPaymentCmd).toHaveBeenCalledTimes(1);
		expect(mut.setSubmitting).toHaveBeenLastCalledWith(false);
		expect(mut.partialReset).toHaveBeenCalled();
	});
});

describe('submitPurchasePayment', () => {
	beforeEach(() => {
		addPaymentCmd.mockReset();
	});

	it('relays the finance payload and resets on success', async () => {
		addPaymentCmd.mockResolvedValueOnce({
			success: true,
			payments: [],
			earlyPaymentBenefits: [],
			balance: { settlementBalance: 0 },
			dueStatus: { kind: 'PAID', date: null, daysUntil: 0 }
		});
		const mut = mutations();

		await submitPurchasePayment({ purchaseOrderId: 'po-1' } as never, mut);

		expect(addPaymentCmd).toHaveBeenCalledTimes(1);
		expect(mut.onFinanceChanged).toHaveBeenCalledTimes(1);
		expect(mut.partialReset).toHaveBeenCalled();
	});

	it('surfaces the command error and keeps state on failure', async () => {
		addPaymentCmd.mockResolvedValueOnce({ success: false, error: 'boom' });
		const mut = mutations();

		await submitPurchasePayment({ purchaseOrderId: 'po-1' } as never, mut);

		expect(mut.onFinanceChanged).not.toHaveBeenCalled();
		expect(mut.partialReset).not.toHaveBeenCalled();

		const { toast } = await import('svelte-sonner');
		expect(toast.error).toHaveBeenCalledWith('boom');
	});
});

describe('submitPaymentWithBenefit', () => {
	const suggestion = {
		amount: 5,
		percent: 5,
		deadline: '2026-10-11',
		currentBalance: 100,
		recommendedPayment: 95,
		overpayment: 0,
		residualAfterPayment: 0
	};

	beforeEach(() => {
		addPaymentCmd.mockReset();
	});

	it('attaches the benefit and adjusts the paid amount to the discounted balance', async () => {
		addPaymentCmd.mockResolvedValueOnce({ success: true });
		const state = flowState({
			pendingAddPayload: {
				purchaseOrderId: 'po-1',
				paymentMethod: PaymentMethod.EFECTIVO_BS,
				amount: 4000
			} as never,
			pendingBenefitSuggestion: suggestion as never,
			benefitAmountInput: '5',
			benefitNoteInput: 'descuento'
		});

		await submitPaymentWithBenefit(true, state, mutations());

		const payload = addPaymentCmd.mock.calls[0][0];
		// USD-BCV settlement: 100 balance − 5 benefit = 95 USD
		expect(payload.amount).toBe(95);
		expect(payload.earlyPaymentBenefit).toMatchObject({
			amountUsdBcv: 5,
			appliedToBalance: true,
			note: 'descuento'
		});
	});

	it('re-computes the native amortization as balance minus benefit', async () => {
		addPaymentCmd.mockResolvedValueOnce({ success: true });
		const state = flowState({
			pendingAddPayload: {
				purchaseOrderId: 'po-1',
				paymentMethod: PaymentMethod.EFECTIVO_EUR,
				amount: 4000,
				amountAppliedToDebt: 100
			} as never,
			pendingBenefitSuggestion: suggestion as never,
			benefitAmountInput: '1',
			isNativeSettlement: true,
			settlementRateToVes: 5800,
			purchaseCurrencyCode: CurrencyCode.EUR_BCV,
			needsSpecificRate: true,
			specificRateValue: 5800
		});

		await submitPaymentWithBenefit(true, state, mutations());

		const payload = addPaymentCmd.mock.calls[0][0];
		// 100 balance − 1 benefit = 99 settlement units amortized, not the pre-benefit 100
		expect(payload.amountAppliedToDebt).toBe(99);
		expect(payload.earlyPaymentBenefit.amountAppliedToDebt).toBe(1);
	});

	it('keeps the paid amount and records a note-only benefit', async () => {
		addPaymentCmd.mockResolvedValueOnce({ success: true });
		const state = flowState({
			pendingAddPayload: { purchaseOrderId: 'po-1', amount: 4000 } as never,
			pendingBenefitSuggestion: suggestion as never,
			benefitAmountInput: '5'
		});

		await submitPaymentWithBenefit(false, state, mutations());

		const payload = addPaymentCmd.mock.calls[0][0];
		expect(payload.amount).toBe(4000);
		expect(payload.earlyPaymentBenefit).toMatchObject({
			amountUsdBcv: 5,
			appliedToBalance: false
		});
	});

	it('rejects an invalid benefit amount', async () => {
		const mut = mutations();
		const state = flowState({
			pendingAddPayload: { purchaseOrderId: 'po-1', amount: 4000 } as never,
			pendingBenefitSuggestion: suggestion as never,
			benefitAmountInput: '0'
		});

		await submitPaymentWithBenefit(true, state, mut);

		expect(addPaymentCmd).not.toHaveBeenCalled();
		expect(mut.setPendingAddPayload).not.toHaveBeenCalled();
	});

	it('rejects a benefit above the suggested discount', async () => {
		const mut = mutations();
		const state = flowState({
			pendingAddPayload: { purchaseOrderId: 'po-1', amount: 4000 } as never,
			pendingBenefitSuggestion: suggestion as never,
			benefitAmountInput: '6'
		});

		await submitPaymentWithBenefit(true, state, mut);

		expect(addPaymentCmd).not.toHaveBeenCalled();
	});
});
