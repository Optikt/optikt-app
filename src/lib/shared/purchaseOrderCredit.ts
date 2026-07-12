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
}

export interface PurchaseOrderEarlyPaymentBenefitLike {
	amountUsdBcv: number;
	appliedToBalance: boolean;
	voidedAt?: string | null;
}

export interface PurchaseOrderBalanceSummary {
	grossTotal: number;
	debtTotal: number;
	totalPaid: number;
	earlyPaymentDiscountEarned: number;
	balance: number;
	isFullyPaid: boolean;
	lastPaymentDate: string | null;
}

export type PurchaseOrderDueState =
	'NONE' | 'PAID' | 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING' | 'EARLY_DISCOUNT_AVAILABLE';

export interface PurchaseOrderDueStatus {
	kind: PurchaseOrderDueState;
	date: string | null;
	daysUntil: number | null;
}

export interface EarlyPaymentDiscountSuggestion {
	amountUsdBcv: number;
	percent: number;
	deadline: string;
	currentBalance: number;
	enteredPaymentUsdBcv: number;
	recommendedPaymentUsdBcv: number;
	overpaymentUsdBcv: number;
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

export function computePurchaseOrderBalance(
	po: PurchaseOrderSettlementDiscountLike,
	items: PurchaseOrderFinancialItem[],
	payments: PurchaseOrderPaymentLike[],
	earlyPaymentBenefits: PurchaseOrderEarlyPaymentBenefitLike[] = []
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

	return {
		grossTotal,
		debtTotal,
		totalPaid,
		earlyPaymentDiscountEarned,
		balance,
		isFullyPaid: balance <= 0.01,
		lastPaymentDate
	};
}

export function getEarlyPaymentDiscountSuggestion({
	terms,
	totalDebt,
	currentBalance,
	paymentAmountUsdBcv,
	paymentDate
}: {
	terms: PurchaseOrderCreditTermsLike;
	totalDebt: number;
	currentBalance: number;
	paymentAmountUsdBcv: number;
	paymentDate: string;
}): EarlyPaymentDiscountSuggestion | null {
	if (terms.paymentTerms !== PurchasePaymentTerms.CREDIT) return null;
	const percent = Number(terms.earlyPaymentDiscountPercent ?? 0);
	const deadline = terms.earlyPaymentDiscountDeadline;
	const paymentDateKey = toDateKey(paymentDate);
	if (!deadline || !paymentDateKey || percent <= 0 || paymentDateKey > deadline) return null;

	const normalizedCurrentBalance = roundCurrency(Math.max(Number(currentBalance || 0), 0));
	const normalizedPaymentAmount = roundCurrency(Math.max(Number(paymentAmountUsdBcv || 0), 0));
	const amountUsdBcv = roundCurrency(
		Math.min((Number(totalDebt || 0) * Math.min(percent, 100)) / 100, normalizedCurrentBalance)
	);
	if (amountUsdBcv <= 0) return null;

	const recommendedPaymentUsdBcv = roundCurrency(
		Math.max(normalizedCurrentBalance - amountUsdBcv, 0)
	);
	if (normalizedPaymentAmount + 0.01 < recommendedPaymentUsdBcv) return null;

	const residualAfterPayment = roundCurrency(
		Math.max(normalizedCurrentBalance - normalizedPaymentAmount, 0)
	);
	const overpaymentUsdBcv = roundCurrency(
		Math.max(normalizedPaymentAmount - recommendedPaymentUsdBcv, 0)
	);

	return {
		amountUsdBcv,
		percent: Math.min(percent, 100),
		deadline,
		currentBalance: normalizedCurrentBalance,
		enteredPaymentUsdBcv: normalizedPaymentAmount,
		recommendedPaymentUsdBcv,
		overpaymentUsdBcv,
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
