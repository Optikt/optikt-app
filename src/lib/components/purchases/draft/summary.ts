/**
 * Purchase order draft summary builder.
 * Pure functions that compute gross/net totals, settlement discounts and profit.
 */

import { PurchaseDiscountType } from '$lib/shared/enums';

import type { PurchaseOrderDraftItem } from './defaults';
import { round2 } from './defaults';
import {
	calculateDraftItemSubtotal,
	calculateDraftItemSubtotalAlt,
	calculateDraftItemTax,
	calculateDraftItemTaxAlt,
	calculateDraftItemTotal,
	calculateDraftItemTotalAlt,
	hasDirectAltPrice
} from './pricing';

export interface PurchaseOrderDiscountInput {
	type: PurchaseDiscountType;
	value: number;
}

export const NO_PURCHASE_ORDER_DISCOUNT: PurchaseOrderDiscountInput = {
	type: PurchaseDiscountType.NONE,
	value: 0
};

export interface PurchaseOrderSummary {
	lineCount: number;
	totalUnits: number;
	/** Gross pre-tax subtotal — matches the delivery note. */
	subtotal: number;
	/** Gross IVA (no discount applied). */
	taxAmount: number;
	/** Gross total = subtotal + taxAmount. Matches the delivery note. */
	total: number;
	/** Gross pre-tax subtotal in alt currency (VES or EUR) when direct alt prices are available. */
	subtotalAlt?: number;
	/** Gross IVA in alt currency when direct alt prices are available. */
	taxAmountAlt?: number;
	/** Gross total in alt currency when direct alt prices are available. */
	totalAlt?: number;
	estimatedSale: number;
	estimatedProfit: number;
	/** Settlement discount applied to the gross subtotal (0 when type=NONE). */
	discountAmount: number;
	/** Settlement discount in the source currency when alt prices are available. */
	discountAmountAlt?: number;
	/** Net pre-tax base after discount = subtotal - discountAmount. */
	netSubtotal: number;
	/** IVA recomputed on the net base (per-line, respects appliesIva). */
	netTaxAmount: number;
	/** Net total (what the fiscal invoice charges). */
	netTotal: number;
	/** Net pre-tax subtotal in alt currency when direct alt prices are available. */
	netSubtotalAlt?: number;
	/** Net IVA in alt currency when direct alt prices are available. */
	netTaxAmountAlt?: number;
	/** Net total in alt currency when direct alt prices are available. */
	netTotalAlt?: number;
	/** Estimated profit using net cost. */
	netEstimatedProfit: number;
}

/**
 * Returns the USD discount amount applied to a gross subtotal.
 * - PERCENT: subtotal × value / 100 (capped 0..100 by validation upstream).
 * - AMOUNT: min(value, subtotal) so we never go negative.
 * - NONE / unknown: 0.
 */
export function applySettlementDiscount(
	subtotalGross: number,
	discount: PurchaseOrderDiscountInput | null | undefined
): number {
	if (!discount) return 0;
	const gross = Number(subtotalGross || 0);
	if (gross <= 0) return 0;
	const value = Number(discount.value || 0);
	if (value <= 0) return 0;
	if (discount.type === PurchaseDiscountType.PERCENT) {
		return round2((gross * Math.min(value, 100)) / 100);
	}
	if (discount.type === PurchaseDiscountType.AMOUNT) {
		return round2(Math.min(value, gross));
	}
	return 0;
}

/**
 * Returns the multiplicative factor that converts gross prices to net prices.
 * factor = (subtotalGross - discountAmount) / subtotalGross, clamped to [0, 1].
 * Returns 1 when there is no discount (or subtotal is zero).
 */
export function getSettlementDiscountFactor(
	subtotalGross: number,
	discount: PurchaseOrderDiscountInput | null | undefined
): number {
	const gross = Number(subtotalGross || 0);
	if (gross <= 0) return 1;
	const discountAmount = applySettlementDiscount(gross, discount);
	if (discountAmount <= 0) return 1;
	const factor = (gross - discountAmount) / gross;
	if (!Number.isFinite(factor)) return 1;
	return Math.max(0, Math.min(1, factor));
}

/**
 * Prorates the per-unit gross purchase price into the per-unit net price.
 * Same factor applies whether `unitPurchasePrice` is pre-tax or tax-included,
 * because the discount scales the pre-tax cost and IVA scales linearly with it.
 */
export function prorateNetUnitPurchasePrice(grossUnitPrice: number, factor: number): number {
	return round2(Number(grossUnitPrice || 0) * factor);
}

export function calculatePurchaseOrderSummary(
	items: PurchaseOrderDraftItem[],
	discount: PurchaseOrderDiscountInput | null | undefined = NO_PURCHASE_ORDER_DISCOUNT,
	bcvRate?: number
): PurchaseOrderSummary {
	const subtotal = items.reduce((sum, item) => sum + calculateDraftItemSubtotal(item), 0);
	const taxAmount = items.reduce((sum, item) => sum + calculateDraftItemTax(item), 0);
	const total = items.reduce((sum, item) => sum + calculateDraftItemTotal(item), 0);
	void bcvRate;
	const shouldCalculateAltTotals = items.some(hasDirectAltPrice);
	const subtotalAlt = shouldCalculateAltTotals
		? round2(items.reduce((sum, item) => sum + calculateDraftItemSubtotalAlt(item), 0))
		: undefined;
	const taxAmountAlt = shouldCalculateAltTotals
		? round2(items.reduce((sum, item) => sum + calculateDraftItemTaxAlt(item), 0))
		: undefined;
	const totalAlt = shouldCalculateAltTotals
		? round2(items.reduce((sum, item) => sum + calculateDraftItemTotalAlt(item), 0))
		: undefined;
	const estimatedSale = items.reduce(
		(sum, item) => sum + Number(item.unitSalePrice || 0) * Number(item.quantity || 0),
		0
	);

	// Apply discount in source currency when alt prices exist and discount is AMOUNT
	const discountBase =
		shouldCalculateAltTotals &&
		discount?.type === PurchaseDiscountType.AMOUNT &&
		(subtotalAlt ?? 0) > 0
			? subtotalAlt!
			: subtotal;
	const discountAmount = applySettlementDiscount(discountBase, discount);
	const factor = getSettlementDiscountFactor(discountBase, discount);
	// Discount in source currency (for display alongside source-currency amounts)
	const discountAmountAlt =
		discountBase !== subtotal ? round2(discountBase - discountBase * factor) : discountAmount;
	const netSubtotal = round2(subtotal - subtotal * (1 - factor));
	const netTaxAmount = items.reduce((sum, item) => sum + calculateDraftItemTax(item) * factor, 0);
	const netTotal = round2(netSubtotal + netTaxAmount);
	const netSubtotalAlt =
		shouldCalculateAltTotals && subtotalAlt != null ? round2(subtotalAlt * factor) : undefined;
	const netTaxAmountAlt =
		shouldCalculateAltTotals && taxAmountAlt != null ? round2(taxAmountAlt * factor) : undefined;
	const netTotalAlt =
		netSubtotalAlt !== undefined && netTaxAmountAlt !== undefined
			? round2(netSubtotalAlt + netTaxAmountAlt)
			: undefined;

	return {
		lineCount: items.length,
		totalUnits: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
		subtotal,
		taxAmount,
		total,
		subtotalAlt,
		taxAmountAlt,
		totalAlt,
		estimatedSale,
		estimatedProfit: estimatedSale - total,
		discountAmount,
		discountAmountAlt: shouldCalculateAltTotals ? discountAmountAlt : undefined,
		netSubtotal,
		netTaxAmount: round2(netTaxAmount),
		netTotal,
		netSubtotalAlt,
		netTaxAmountAlt,
		netTotalAlt,
		netEstimatedProfit: estimatedSale - netTotal
	};
}
