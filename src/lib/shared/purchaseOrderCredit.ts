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

export interface PurchaseOrderPaymentLike {
	amountUsdBcv: number;
	paymentDate: string;
	voidedAt?: string | null;
	currencyCode?: CurrencyCode | string;
}

export interface PurchaseOrderCreditInstallmentLike {
	installmentNumber: number;
	dueDate: string;
	expectedAmountUsd: number | null;
	earlyPaymentDiscountPercent: number | null;
	earlyPaymentDiscountDeadline: string | null;
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
	| 'NONE'
	| 'PAID'
	| 'OVERDUE'
	| 'DUE_TODAY'
	| 'UPCOMING'
	| 'EARLY_DISCOUNT_AVAILABLE';

export interface PurchaseOrderDueStatus {
	kind: PurchaseOrderDueState;
	date: string | null;
	daysUntil: number | null;
}

interface ResolvedInstallment extends PurchaseOrderCreditInstallmentLike {
	resolvedExpectedAmountUsd: number;
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

function resolveInstallments(
	totalDebt: number,
	installments: PurchaseOrderCreditInstallmentLike[]
): ResolvedInstallment[] | null {
	if (installments.length === 0) return [];

	const sorted = [...installments].sort((left, right) => {
		if (left.installmentNumber !== right.installmentNumber) {
			return left.installmentNumber - right.installmentNumber;
		}
		return left.dueDate.localeCompare(right.dueDate);
	});

	const missing = sorted.filter((installment) => installment.expectedAmountUsd == null);
	if (missing.length === 0) {
		return sorted.map((installment) => ({
			...installment,
			resolvedExpectedAmountUsd: Number(installment.expectedAmountUsd ?? 0)
		}));
	}

	if (sorted.length === 1) {
		return [
			{
				...sorted[0],
				resolvedExpectedAmountUsd: roundCurrency(totalDebt)
			}
		];
	}

	if (missing.length === 1) {
		const knownTotal = sorted.reduce(
			(sum, installment) => sum + Number(installment.expectedAmountUsd ?? 0),
			0
		);
		const remainder = roundCurrency(Math.max(totalDebt - knownTotal, 0));
		return sorted.map((installment) => ({
			...installment,
			resolvedExpectedAmountUsd: Number(installment.expectedAmountUsd ?? remainder)
		}));
	}

	return null;
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
	totalDebt: number,
	installments: PurchaseOrderCreditInstallmentLike[],
	payments: PurchaseOrderPaymentLike[]
): number {
	const activePayments = getActivePayments(payments).sort((left, right) =>
		left.paymentDate.localeCompare(right.paymentDate)
	);
	if (activePayments.length === 0 || installments.length === 0) return 0;

	const resolved = resolveInstallments(totalDebt, installments);
	if (!resolved) return 0;

	let cumulativeThreshold = 0;
	let earned = 0;

	for (const installment of resolved) {
		const baseAmount = installment.resolvedExpectedAmountUsd;
		const percent = Number(installment.earlyPaymentDiscountPercent ?? 0);
		const deadline = installment.earlyPaymentDiscountDeadline;
		const discountAmount =
			deadline && percent > 0 ? roundCurrency((baseAmount * percent) / 100) : 0;
		const requiredByDeadline = roundCurrency(baseAmount - discountAmount);
		cumulativeThreshold = roundCurrency(cumulativeThreshold + requiredByDeadline);

		if (!deadline || discountAmount <= 0) continue;

		const paidByDeadline = roundCurrency(
			activePayments
				.filter((payment) => (toDateKey(payment.paymentDate) ?? '') <= deadline)
				.reduce((sum, payment) => sum + Number(payment.amountUsdBcv || 0), 0)
		);

		if (paidByDeadline + 0.01 >= cumulativeThreshold) {
			earned = roundCurrency(earned + discountAmount);
		}
	}

	const totalPaid = roundCurrency(
		activePayments.reduce((sum, payment) => sum + Number(payment.amountUsdBcv || 0), 0)
	);
	const unpaidGap = roundCurrency(Math.max(totalDebt - totalPaid, 0));

	return Math.min(earned, unpaidGap);
}

export function computePurchaseOrderBalance(
	po: PurchaseOrderSettlementDiscountLike,
	items: PurchaseOrderFinancialItem[],
	payments: PurchaseOrderPaymentLike[],
	installments: PurchaseOrderCreditInstallmentLike[] = []
): PurchaseOrderBalanceSummary {
	const activePayments = getActivePayments(payments);
	const grossTotal = calculatePurchaseOrderGrossTotal(items);
	const debtTotal = calculatePurchaseOrderDebtTotal(items, po);
	const totalPaid = roundCurrency(
		activePayments.reduce((sum, payment) => sum + Number(payment.amountUsdBcv || 0), 0)
	);
	const earlyPaymentDiscountEarned = getEarlyPaymentDiscountEarned(
		debtTotal,
		installments,
		activePayments
	);
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

export function getPurchaseOrderDueStatus({
	paymentTerms,
	installments,
	balance,
	referenceDate = new Date().toISOString().slice(0, 10)
}: {
	paymentTerms: string;
	installments: PurchaseOrderCreditInstallmentLike[];
	balance: number;
	referenceDate?: string;
}): PurchaseOrderDueStatus {
	if (balance <= 0.01) {
		return { kind: 'PAID', date: null, daysUntil: 0 };
	}

	if (paymentTerms !== PurchasePaymentTerms.CREDIT || installments.length === 0) {
		return { kind: 'NONE', date: null, daysUntil: null };
	}

	const sorted = [...installments].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
	const overdue = sorted.find((installment) => installment.dueDate < referenceDate);
	if (overdue) {
		return {
			kind: 'OVERDUE',
			date: overdue.dueDate,
			daysUntil: daysBetween(referenceDate, overdue.dueDate)
		};
	}

	const dueToday = sorted.find((installment) => installment.dueDate === referenceDate);
	if (dueToday) {
		return { kind: 'DUE_TODAY', date: dueToday.dueDate, daysUntil: 0 };
	}

	const earlyDiscount = sorted
		.filter((installment) => installment.earlyPaymentDiscountDeadline)
		.find((installment) => (installment.earlyPaymentDiscountDeadline ?? '') >= referenceDate);
	if (earlyDiscount?.earlyPaymentDiscountDeadline) {
		return {
			kind: 'EARLY_DISCOUNT_AVAILABLE',
			date: earlyDiscount.earlyPaymentDiscountDeadline,
			daysUntil: daysBetween(referenceDate, earlyDiscount.earlyPaymentDiscountDeadline)
		};
	}

	const upcoming = sorted.find((installment) => installment.dueDate > referenceDate);
	if (upcoming) {
		return {
			kind: 'UPCOMING',
			date: upcoming.dueDate,
			daysUntil: daysBetween(referenceDate, upcoming.dueDate)
		};
	}

	return { kind: 'NONE', date: null, daysUntil: null };
}
