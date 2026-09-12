/**
 * Purchase orders remote — shared types + finance validation
 * Split from purchaseOrders.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */

import { z } from 'zod';
import { SavePurchaseOrderDraftSchema } from '$lib/schemas/purchaseOrders';

import { SetPurchaseOrderCreditTermsSchema } from '$lib/schemas/purchaseOrderCreditSchedule';
import {
	findPurchaseOrderById,
	getPurchaseOrderItems
} from '$lib/server/db/queries/purchaseOrders';

import type {
	PurchaseOrderWithRelations,
	PurchaseOrderItemWithProduct,
	PurchaseOrderItemDraftInput
} from '$lib/server/db/queries/purchaseOrders';

import { PurchaseOrderItemType, PurchasePaymentTerms } from '$lib/shared/enums';

import { validatePurchaseOrderDraftReadiness } from '$lib/shared/purchaseOrderRules';
import {
	type PurchaseOrderBalanceSummary,
	type PurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';

import type {
	PurchaseOrder,
	PurchaseOrderEarlyPaymentBenefit,
	PurchaseOrderPayment
} from '$lib/server/db/schema';

// ============================================================================
// TYPES
// ============================================================================

export interface PriceSuggestion {
	productId: string;
	productName: string;
	productSku: string;
	currentSalePrice: number | null;
	suggestedSalePrice: number;
}

export interface PurchaseOrderDetail {
	purchaseOrder: PurchaseOrderWithRelations;
	items: PurchaseOrderItemWithProduct[];
	payments: PurchaseOrderPayment[];
	earlyPaymentBenefits: PurchaseOrderEarlyPaymentBenefit[];
	balance: PurchaseOrderBalanceSummary;
	dueStatus: PurchaseOrderDueStatus;
}

export type SavePurchaseOrderDraftInput = z.infer<typeof SavePurchaseOrderDraftSchema>;

type PurchaseOrderCreditTermsInput = {
	purchaseOrderId: string;
	paymentTerms: PurchasePaymentTerms;
	creditDueDate?: string | null;
	earlyPaymentDiscountPercent?: number | null;
	earlyPaymentDiscountDeadline?: string | null;
};

export function uniqueIssues(issues: string[]): string[] {
	return [...new Set(issues.filter(Boolean))];
}

export function normalizeCreditTermsForWrite(
	terms: Omit<PurchaseOrderCreditTermsInput, 'purchaseOrderId'>
): Pick<
	PurchaseOrder,
	'paymentTerms' | 'creditDueDate' | 'earlyPaymentDiscountPercent' | 'earlyPaymentDiscountDeadline'
> {
	if (terms.paymentTerms === PurchasePaymentTerms.CONTADO) {
		return {
			paymentTerms: terms.paymentTerms,
			creditDueDate: null,
			earlyPaymentDiscountPercent: null,
			earlyPaymentDiscountDeadline: null
		};
	}

	const earlyPaymentDiscountPercent = Number(terms.earlyPaymentDiscountPercent ?? 0);
	return {
		paymentTerms: terms.paymentTerms,
		creditDueDate: terms.creditDueDate ?? null,
		earlyPaymentDiscountPercent:
			earlyPaymentDiscountPercent > 0 ? earlyPaymentDiscountPercent : null,
		earlyPaymentDiscountDeadline:
			earlyPaymentDiscountPercent > 0 ? (terms.earlyPaymentDiscountDeadline ?? null) : null
	};
}

export function getPurchaseOrderFinanceIssues(terms: PurchaseOrderCreditTermsInput): string[] {
	const parsed = SetPurchaseOrderCreditTermsSchema.safeParse(terms);
	return parsed.success
		? []
		: uniqueIssues(parsed.error.issues.map((issue) => issue.message).filter(Boolean));
}

export function toPurchaseOrderItemDraftInput(
	item: SavePurchaseOrderDraftInput['items'][number]
): PurchaseOrderItemDraftInput {
	return {
		id: item.id,
		itemType: item.itemType as PurchaseOrderItemType,
		productId: item.productId ?? null,
		lensCatalogItemId: item.lensCatalogItemId ?? null,
		quantity: item.quantity,
		unitPurchasePrice: item.unitPurchasePrice,
		unitPurchasePriceAlt: item.unitPurchasePriceAlt ?? null,
		unitSalePrice: item.unitSalePrice,
		isZeroPriceIntentional: item.isZeroPriceIntentional,
		appliesIva: item.appliesIva,
		ivaRate: item.ivaRate,
		isReviewed: item.isReviewed
	};
}

export async function getPurchaseOrderReadinessIssues(id: string): Promise<string[]> {
	const po = await findPurchaseOrderById(id);
	if (!po) return ['Orden de compra no encontrada'];

	const items = await getPurchaseOrderItems(id);
	const result = validatePurchaseOrderDraftReadiness(
		{
			supplierId: po.supplierId,
			orderDate: po.orderDate,
			bcvRate: po.bcvRate,
			notes: po.notes
		},
		items.map((item) => ({
			itemType: item.itemType,
			productId: item.productId,
			lensCatalogItemId: item.lensCatalogItemId,
			quantity: item.quantity,
			unitPurchasePrice: item.unitPurchasePrice,
			unitSalePrice: item.unitSalePrice,
			appliesIva: item.appliesIva,
			ivaRate: item.ivaRate
		}))
	);
	const financeIssues = getPurchaseOrderFinanceIssues({
		purchaseOrderId: id,
		paymentTerms: po.paymentTerms as PurchasePaymentTerms,
		creditDueDate: po.creditDueDate,
		earlyPaymentDiscountPercent: po.earlyPaymentDiscountPercent,
		earlyPaymentDiscountDeadline: po.earlyPaymentDiscountDeadline
	});

	return [...result.issues, ...financeIssues];
}
