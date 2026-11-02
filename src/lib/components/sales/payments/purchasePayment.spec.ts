import { describe, expect, it, vi } from 'vitest';
import { CurrencyCode, PaymentMethod, PurchasePaymentTerms } from '$lib/shared/enums';
import type { PurchaseOrder } from '$lib/server/db/schema';
import {
	computeAmountAppliedToDebt,
	computeDeliveryAmountForAppliedDebt,
	computeProntoPagoInfo,
	maybeSubmitPurchase,
	type PurchaseFlowState,
	type PurchaseFlowMutations
} from './purchasePayment';

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
});
