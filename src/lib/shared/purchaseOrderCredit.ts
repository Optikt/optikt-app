import { CurrencyCode, PurchaseDiscountType, PurchasePaymentTerms } from '$lib/shared/enums';

export interface PurchaseOrderFinancialItem {
	quantity: number;
	unitPurchasePrice: number;
	appliesIva: boolean;
	ivaRate: number;
}

export interface PurchaseOrderSettlementDiscountLike {
	settlementDiscountType: string | null;
	settlementDiscountValue: number | null;
}

export interface PurchaseOrderCreditTermsLike {
	paymentTerms?: string | null;
	creditDueDate?: string | null;
	earlyPaymentDiscountPercent?: number | null;
	earlyPaymentDiscountDeadline?: string | null;
}

export interface PurchaseOrderPaymentLike {
	amountUsdBcv: number;
	paymentDate: string;
	voidedAt?: string | null;
	currencyCode?: CurrencyCode | string;
	/** Debt amortized by this payment, in the order's settlement currency. Falls back to amountUsdBcv when absent (legacy). */
	amountAppliedToDebt?: number | null;
	/** USD-BCV reference of amountAppliedToDebt at order-issuance time. */
	amountAppliedToDebtUsdBcvAtOrder?: number | null;
}

export interface PurchaseOrderEarlyPaymentBenefitLike {
	amountUsdBcv: number;
	appliedToBalance: boolean;
	voidedAt?: string | null;
	/** Debt relief applied by this benefit, in the order's settlement currency. */
	amountAppliedToDebt?: number | null;
	/** USD-BCV reference at order-issuance time. */
	amountAppliedToDebtUsdBcvAtOrder?: number | null;
}

export interface PurchaseOrderBalanceSummary {
	grossTotal: number;
	debtTotal: number;
	totalPaid: number;
	earlyPaymentDiscountEarned: number;
	balance: number;
	isFullyPaid: boolean;
	lastPaymentDate: string | null;

	/** Currency the supplier requires for settlement. */
	settlementCurrency: string;
	/** Gross contractual debt before discount, in settlement currency. */
	settlementGrossAmount: number;
	/** Net contractual debt after discount, in settlement currency. */
	settlementDebtAmount: number;
	/** Total amortized (sum of amountAppliedToDebt) in settlement currency. */
	totalAppliedToDebt: number;
	/** Early-payment benefits consumed, in settlement currency. */
	settlementBenefitsApplied: number;
	/** Remaining settlement balance (native). */
	settlementBalance: number;
	/** Whether the settlement balance is fully paid in native terms. */
	isSettlementFullyPaid: boolean;
	/** Cumulative exchange variance (sum across all payments). */
	totalExchangeVariance: number;
}

export type PurchaseOrderDueState =
	'NONE' | 'PAID' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'EARLY_DISCOUNT_AVAILABLE';

export interface PurchaseOrderDueStatus {
	kind: PurchaseOrderDueState;
	date: string | null;
	daysUntil: number | null;
}

export interface EarlyPaymentDiscountSuggestion {
	/** Discount amount (in the same currency as the debt). */
	amount: number;
	percent: number;
	deadline: string;
	currentBalance: number;
	enteredPayment: number;
	recommendedPayment: number;
	overpayment: number;
	residualAfterPayment: number;
}

function roundCurrency(value: number): number {
	return Number(value.toFixed(2));
}

function toDateKey(value: string | null | undefined): string | null {
	if (!value) return null;
	return value.slice(0, 10);
}

function daysBetween(fromDate: string, toDate: string): number {
	const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number);
	const [toYear, toMonth, toDay] = toDate.split('-').map(Number);
	const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
	const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
	return Math.round((toUtc - fromUtc) / 86_400_000);
}

function getActivePayments(payments: PurchaseOrderPaymentLike[]): PurchaseOrderPaymentLike[] {
	return payments.filter((payment) => !payment.voidedAt);
}

function getActiveAppliedBenefits(
	benefits: PurchaseOrderEarlyPaymentBenefitLike[]
): PurchaseOrderEarlyPaymentBenefitLike[] {
	return benefits.filter((benefit) => benefit.appliedToBalance && !benefit.voidedAt);
}

function getDiscountFactor(
	items: PurchaseOrderFinancialItem[],
	po: PurchaseOrderSettlementDiscountLike
): number {
	const type = po.settlementDiscountType as PurchaseDiscountType | null;
	const value = Number(po.settlementDiscountValue ?? 0);
	if (!type || type === PurchaseDiscountType.NONE || value <= 0) return 1;

	const subtotalPreTax = items.reduce((sum, item) => {
		const unit = Number(item.unitPurchasePrice || 0);
		const preTax = item.appliesIva && item.ivaRate ? unit / (1 + item.ivaRate / 100) : unit;
		return sum + preTax * Number(item.quantity || 0);
	}, 0);

	if (subtotalPreTax <= 0) return 1;

	const discountAmount =
		type === PurchaseDiscountType.PERCENT
			? (subtotalPreTax * Math.min(value, 100)) / 100
			: Math.min(value, subtotalPreTax);

	return Math.max(0, Math.min(1, (subtotalPreTax - discountAmount) / subtotalPreTax));
}

export function calculatePurchaseOrderGrossTotal(items: PurchaseOrderFinancialItem[]): number {
	return roundCurrency(
		items.reduce(
			(sum, item) => sum + Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0),
			0
		)
	);
}

export function calculatePurchaseOrderDebtTotal(
	items: PurchaseOrderFinancialItem[],
	po: PurchaseOrderSettlementDiscountLike
): number {
	const grossTotal = calculatePurchaseOrderGrossTotal(items);
	const discountFactor = getDiscountFactor(items, po);
	return roundCurrency(grossTotal * discountFactor);
}

export function getEarlyPaymentDiscountEarned(
	benefits: PurchaseOrderEarlyPaymentBenefitLike[]
): number {
	return roundCurrency(
		getActiveAppliedBenefits(benefits).reduce(
			(sum, benefit) => sum + Number(benefit.amountUsdBcv || 0),
			0
		)
	);
}

/** Sum of active applied settlement-currency benefit amounts (native). */
export function getEarlyPaymentDiscountEarnedNative(
	benefits: PurchaseOrderEarlyPaymentBenefitLike[]
): number {
	return roundCurrency(
		getActiveAppliedBenefits(benefits).reduce(
			(sum, benefit) => sum + Number(benefit.amountAppliedToDebt ?? benefit.amountUsdBcv ?? 0),
			0
		)
	);
}

export function computePurchaseOrderBalance(
	po: PurchaseOrderSettlementDiscountLike,
	items: PurchaseOrderFinancialItem[],
	payments: PurchaseOrderPaymentLike[],
	earlyPaymentBenefits: PurchaseOrderEarlyPaymentBenefitLike[] = [],
	/** Optional settlement header — when absent, native = USD-BCV (legacy backward compat). */
	settlement?: {
		settlementCurrency?: string | null;
		settlementGrossAmount?: number | null;
		settlementDebtAmount?: number | null;
		settlementDebtAmountUsdBcvAtOrder?: number | null;
	}
): PurchaseOrderBalanceSummary {
	const activePayments = getActivePayments(payments);
	const grossTotal = calculatePurchaseOrderGrossTotal(items);
	const debtTotal = calculatePurchaseOrderDebtTotal(items, po);
	const totalPaid = roundCurrency(
		activePayments.reduce((sum, payment) => sum + Number(payment.amountUsdBcv || 0), 0)
	);
	const earlyPaymentDiscountEarned = getEarlyPaymentDiscountEarned(earlyPaymentBenefits);
	const balance = roundCurrency(Math.max(debtTotal - totalPaid - earlyPaymentDiscountEarned, 0));
	const lastPaymentDate =
		activePayments.length === 0
			? null
			: activePayments
					.map((payment) => payment.paymentDate)
					.sort((left, right) => right.localeCompare(left))[0];

	// --- Native settlement balance ---
	const settlementCurrency = settlement?.settlementCurrency || CurrencyCode.USD_BCV;
	const settlementGrossAmount = Number(settlement?.settlementGrossAmount ?? grossTotal);
	const settlementDebtAmount = Number(settlement?.settlementDebtAmount ?? debtTotal);

	const totalAppliedToDebt = roundCurrency(
		activePayments.reduce(
			(sum, payment) => sum + Number(payment.amountAppliedToDebt ?? payment.amountUsdBcv ?? 0),
			0
		)
	);
	const settlementBenefitsApplied = getEarlyPaymentDiscountEarnedNative(earlyPaymentBenefits);
	const settlementBalance = roundCurrency(
		Math.max(settlementDebtAmount - totalAppliedToDebt - settlementBenefitsApplied, 0)
	);

	// Exchange variance per payment: original BCV value of the amortized portion - actual BCV paid
	let totalExchangeVariance = 0;
	if (settlementDebtAmount > 0) {
		for (const payment of activePayments) {
			const appliedBcv = Number(
				payment.amountAppliedToDebtUsdBcvAtOrder ?? payment.amountUsdBcv ?? 0
			);
			const actualBcv = Number(payment.amountUsdBcv ?? 0);
			totalExchangeVariance += appliedBcv - actualBcv;
		}
	}
	// Also add benefit variance
	for (const benefit of getActiveAppliedBenefits(earlyPaymentBenefits)) {
		const appliedBcv = Number(
			benefit.amountAppliedToDebtUsdBcvAtOrder ?? benefit.amountUsdBcv ?? 0
		);
		const benefitBcv = Number(benefit.amountUsdBcv ?? 0);
		totalExchangeVariance += appliedBcv - benefitBcv;
	}
	totalExchangeVariance = roundCurrency(totalExchangeVariance);

	return {
		grossTotal,
		debtTotal,
		totalPaid,
		earlyPaymentDiscountEarned,
		balance,
		isFullyPaid: balance <= 0.01,
		lastPaymentDate,

		settlementCurrency,
		settlementGrossAmount,
		settlementDebtAmount,
		totalAppliedToDebt,
		settlementBenefitsApplied,
		settlementBalance,
		isSettlementFullyPaid: settlementBalance <= 0.01,
		totalExchangeVariance
	};
}

export function getEarlyPaymentDiscountSuggestion({
	terms,
	totalDebt,
	currentBalance,
	paymentAmount,
	paymentDate
}: {
	terms: PurchaseOrderCreditTermsLike;
	totalDebt: number;
	currentBalance: number;
	paymentAmount: number;
	paymentDate: string;
}): EarlyPaymentDiscountSuggestion | null {
	if (terms.paymentTerms !== PurchasePaymentTerms.CREDIT) return null;
	const percent = Number(terms.earlyPaymentDiscountPercent ?? 0);
	const deadline = terms.earlyPaymentDiscountDeadline;
	const paymentDateKey = toDateKey(paymentDate);
	if (!deadline || !paymentDateKey || percent <= 0 || paymentDateKey > deadline) return null;

	const normalizedCurrentBalance = roundCurrency(Math.max(Number(currentBalance || 0), 0));
	const normalizedPaymentAmount = roundCurrency(Math.max(Number(paymentAmount || 0), 0));
	const discountAmount = roundCurrency(
		Math.min((Number(totalDebt || 0) * Math.min(percent, 100)) / 100, normalizedCurrentBalance)
	);
	if (discountAmount <= 0) return null;

	const recommendedPayment = roundCurrency(Math.max(normalizedCurrentBalance - discountAmount, 0));
	if (normalizedPaymentAmount + 0.01 < recommendedPayment) return null;

	const residualAfterPayment = roundCurrency(
		Math.max(normalizedCurrentBalance - normalizedPaymentAmount, 0)
	);
	const overpayment = roundCurrency(Math.max(normalizedPaymentAmount - recommendedPayment, 0));

	return {
		amount: discountAmount,
		percent: Math.min(percent, 100),
		deadline,
		currentBalance: normalizedCurrentBalance,
		enteredPayment: normalizedPaymentAmount,
		recommendedPayment,
		overpayment,
		residualAfterPayment
	};
}

export function getPurchaseOrderDueStatus({
	paymentTerms,
	creditDueDate,
	earlyPaymentDiscountDeadline,
	balance,
	referenceDate = new Date().toISOString().slice(0, 10)
}: {
	paymentTerms: string;
	creditDueDate?: string | null;
	earlyPaymentDiscountDeadline?: string | null;
	balance: number;
	referenceDate?: string;
}): PurchaseOrderDueStatus {
	if (balance <= 0.01) {
		return { kind: 'PAID', date: null, daysUntil: 0 };
	}

	if (paymentTerms !== PurchasePaymentTerms.CREDIT || !creditDueDate) {
		return { kind: 'NONE', date: null, daysUntil: null };
	}

	if (creditDueDate < referenceDate) {
		return {
			kind: 'OVERDUE',
			date: creditDueDate,
			daysUntil: daysBetween(referenceDate, creditDueDate)
		};
	}

	if (creditDueDate === referenceDate) {
		return { kind: 'DUE_TODAY', date: creditDueDate, daysUntil: 0 };
	}

	if (earlyPaymentDiscountDeadline && earlyPaymentDiscountDeadline >= referenceDate) {
		return {
			kind: 'EARLY_DISCOUNT_AVAILABLE',
			date: earlyPaymentDiscountDeadline,
			daysUntil: daysBetween(referenceDate, earlyPaymentDiscountDeadline)
		};
	}

	return {
		kind: 'UPCOMING',
		date: creditDueDate,
		daysUntil: daysBetween(referenceDate, creditDueDate)
	};
}
