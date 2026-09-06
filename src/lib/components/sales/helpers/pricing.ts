/**
 * Line pricing helpers for the sale wizard.
 * Pure functions that operate on SaleItemRow.
 */

import { clampDiscountValue, computeDiscount, isDiscountValueValid } from '$lib/utils';

import type { SaleItemRow } from '../newSaleTypes';
import { getEnabledEyeCount } from './items';

export function computeItemDiscount(item: SaleItemRow): number {
	const lineTotal = getItemDiscountBase(item);
	const discountValue = clampDiscountValue(item.discount, item.discountType, lineTotal);
	return computeDiscount(discountValue, item.discountType, lineTotal);
}

export function itemLineTotal(item: SaleItemRow): number {
	return getItemDiscountBase(item) - computeItemDiscount(item);
}

export function step2ItemLineTotal(item: SaleItemRow): number {
	const qty =
		item.kind === 'product' || item.kind === 'free' || item.kind === 'treatment'
			? item.quantity
			: 1;
	return item.unitPrice * qty;
}

export function getItemDiscountBase(item: SaleItemRow): number {
	const qty =
		item.kind === 'product' || item.kind === 'free' || item.kind === 'treatment'
			? item.quantity
			: 1;
	return item.unitPrice * qty;
}

export function getItemDiscountMax(item: SaleItemRow): number {
	return item.discountType === 'PERCENTAGE' ? 100 : getItemDiscountBase(item);
}

export function isItemDiscountValid(item: SaleItemRow): boolean {
	return isDiscountValueValid(item.discount, item.discountType, getItemDiscountBase(item));
}

export function getLensTreatmentsTotal(item: SaleItemRow): number {
	if (item.kind !== 'lens') return 0;
	const eyeCount = getEnabledEyeCount(item);
	return item.treatments.reduce((sum, treatment) => sum + treatment.price * eyeCount, 0);
}

export function calculateSaleSummarySubtotal(items: SaleItemRow[]): number {
	return items.reduce((acc, item) => acc + itemLineTotal(item), 0);
}
