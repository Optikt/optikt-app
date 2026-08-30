/**
 * Purchase order draft validation helpers.
 * Pure functions that check readiness, credit terms and review status.
 */

import { PurchasePaymentTerms } from '$lib/shared/enums';
import {
	isPurchaseOrderDraftReady,
	validatePurchaseOrderDraftReadiness,
	type PurchaseOrderDraftHeaderRulesInput,
	type PurchaseOrderDraftReadinessResult
} from '$lib/shared/purchaseOrderRules';

import type { PurchaseOrderDraftItem } from './defaults';

export interface PurchaseOrderCreditTermsValidationResult {
	isValid: boolean;
	issues: string[];
}

export interface PurchaseOrderDraftFinanceInput {
	paymentTerms: PurchasePaymentTerms;
	creditDueDate: string | null;
	earlyPaymentDiscountPercent: number | null;
	earlyPaymentDiscountDeadline: string | null;
}

export interface PurchaseOrderReviewStatus {
	totalCount: number;
	reviewedCount: number;
	pendingCount: number;
	allReviewed: boolean;
}

function isIsoDateOnly(value: string | null | undefined): value is string {
	if (!value) return false;
	if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
	return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

export function validatePurchaseOrderDraft(
	header: PurchaseOrderDraftHeaderRulesInput,
	items: PurchaseOrderDraftItem[],
	finance?: PurchaseOrderDraftFinanceInput
): PurchaseOrderDraftReadinessResult {
	const readiness = validatePurchaseOrderDraftReadiness(header, items);
	if (!finance) return readiness;

	const creditTerms = validateCreditTerms(
		finance.paymentTerms,
		finance.creditDueDate,
		finance.earlyPaymentDiscountPercent,
		finance.earlyPaymentDiscountDeadline
	);

	return {
		isReady: readiness.isReady && creditTerms.isValid,
		issues: [...readiness.issues, ...creditTerms.issues]
	};
}

export function canPersistPurchaseOrderDraft(
	header: PurchaseOrderDraftHeaderRulesInput,
	items: PurchaseOrderDraftItem[],
	finance?: PurchaseOrderDraftFinanceInput
): boolean {
	if (!finance) {
		return isPurchaseOrderDraftReady(header, items);
	}

	return validatePurchaseOrderDraft(header, items, finance).isReady;
}

export function validateCreditTerms(
	paymentTerms: PurchasePaymentTerms,
	creditDueDate: string | null,
	earlyPaymentDiscountPercent: number | null,
	earlyPaymentDiscountDeadline: string | null
): PurchaseOrderCreditTermsValidationResult {
	const issues: string[] = [];

	if (paymentTerms === PurchasePaymentTerms.CONTADO) {
		if (
			creditDueDate ||
			Number(earlyPaymentDiscountPercent ?? 0) > 0 ||
			earlyPaymentDiscountDeadline
		) {
			issues.push('Las órdenes de contado no deben tener términos de crédito');
		}

		return {
			isValid: issues.length === 0,
			issues
		};
	}

	if (!isIsoDateOnly(creditDueDate)) {
		issues.push('Debes indicar una fecha de vencimiento válida para el crédito');
	}

	const discountPercent = Number(earlyPaymentDiscountPercent ?? 0);
	const hasDiscountPercent = discountPercent > 0;
	const hasDiscountDeadline = Boolean(earlyPaymentDiscountDeadline);

	if (hasDiscountPercent && !isIsoDateOnly(earlyPaymentDiscountDeadline)) {
		issues.push('La fecha límite de pronto pago es obligatoria');
	}

	if (hasDiscountDeadline && !hasDiscountPercent) {
		issues.push('El porcentaje de pronto pago es obligatorio');
	}

	if (hasDiscountPercent && discountPercent > 100) {
		issues.push('El porcentaje de pronto pago no puede superar 100');
	}

	if (
		isIsoDateOnly(earlyPaymentDiscountDeadline) &&
		isIsoDateOnly(creditDueDate) &&
		earlyPaymentDiscountDeadline > creditDueDate
	) {
		issues.push('La fecha de pronto pago no puede ser posterior al vencimiento');
	}

	return {
		isValid: issues.length === 0,
		issues
	};
}

export function getPurchaseOrderReviewStatus(
	items: { isReviewed: boolean }[]
): PurchaseOrderReviewStatus {
	const reviewedCount = items.filter((item) => item.isReviewed).length;
	const totalCount = items.length;

	return {
		totalCount,
		reviewedCount,
		pendingCount: totalCount - reviewedCount,
		allReviewed: totalCount > 0 && reviewedCount === totalCount
	};
}

export function isDraftItemUserEditingLocked(item: { isReviewed: boolean }): boolean {
	return item.isReviewed;
}
