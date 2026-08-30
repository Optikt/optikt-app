/**
 * Purchase order draft line pricing helpers.
 * Pure functions that compute per-line totals in primary and alt currency.
 */

import type { PurchaseOrderDraftItem } from './defaults';
import { round2 } from './defaults';

export function getPreTaxUnitPrice(item: PurchaseOrderDraftItem): number {
	if (!item.appliesIva || !item.ivaRate) return item.unitPurchasePrice;
	return item.unitPurchasePrice / (1 + item.ivaRate / 100);
}

export function calculateUnitPurchasePriceFromLineTotal(
	lineTotal: number,
	quantity: number
): number {
	const normalizedTotal = Number(lineTotal || 0);
	const normalizedQuantity = Number(quantity || 0);

	if (!Number.isFinite(normalizedTotal) || normalizedTotal < 0) return 0;
	if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0) return 0;

	return normalizedTotal / normalizedQuantity;
}

export function calculateUnitPurchasePriceAltFromLineTotal(
	lineTotalAlt: number,
	quantity: number,
	appliesIva: boolean,
	ivaRate: number
): number {
	const unitPurchasePriceWithTaxAlt = calculateUnitPurchasePriceFromLineTotal(
		lineTotalAlt,
		quantity
	);

	if (!appliesIva || !ivaRate) return round2(unitPurchasePriceWithTaxAlt);

	return round2(unitPurchasePriceWithTaxAlt / (1 + Number(ivaRate || 0) / 100));
}

export function calculateDraftItemSubtotal(item: PurchaseOrderDraftItem): number {
	return getPreTaxUnitPrice(item) * Number(item.quantity || 0);
}

export function calculateDraftItemTax(item: PurchaseOrderDraftItem): number {
	if (!item.appliesIva) return 0;
	return calculateDraftItemSubtotal(item) * (Number(item.ivaRate || 0) / 100);
}

export function calculateDraftItemTotal(item: PurchaseOrderDraftItem): number {
	return Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0);
}

export function calculateOrderSubtotal(items: PurchaseOrderDraftItem[]): number {
	return items.reduce(
		(sum, item) => sum + Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0),
		0
	);
}

export function calculateOrderIva(items: PurchaseOrderDraftItem[], isInvoice: boolean): number {
	if (!isInvoice) return 0;
	return items.reduce((total, item) => {
		if (!item.appliesIva) return total;
		const lineSubtotal = Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0);
		return total + lineSubtotal * (Number(item.ivaRate || 0) / 100);
	}, 0);
}

export function calculateOrderTotal(items: PurchaseOrderDraftItem[], isInvoice: boolean): number {
	return calculateOrderSubtotal(items) + calculateOrderIva(items, isInvoice);
}

export function calculateDraftItemSubtotalAlt(item: PurchaseOrderDraftItem): number {
	const unitPriceVes = Number(item.unitPurchasePriceAlt ?? 0);
	const quantity = Number(item.quantity || 0);

	if (!Number.isFinite(unitPriceVes) || unitPriceVes < 0) return 0;
	if (!Number.isFinite(quantity) || quantity <= 0) return 0;

	return round2(unitPriceVes * quantity);
}

export function calculateDraftItemTaxAlt(item: PurchaseOrderDraftItem): number {
	if (!item.appliesIva) return 0;
	return round2(calculateDraftItemSubtotalAlt(item) * (Number(item.ivaRate || 0) / 100));
}

export function calculateDraftItemTotalAlt(item: PurchaseOrderDraftItem): number {
	return round2(calculateDraftItemSubtotalAlt(item) + calculateDraftItemTaxAlt(item));
}

export function hasDirectAltPrice(item: PurchaseOrderDraftItem): boolean {
	return item.unitPurchasePriceAlt !== undefined && item.unitPurchasePriceAlt !== null;
}

export function calculateNetDraftItemSubtotalAlt(
	item: PurchaseOrderDraftItem,
	factor: number
): number {
	return round2(calculateDraftItemSubtotalAlt(item) * factor);
}

export function _calculateNetDraftItemTaxAlt(item: PurchaseOrderDraftItem, factor: number): number {
	if (!item.appliesIva) return 0;
	return round2(calculateNetDraftItemSubtotalAlt(item, factor) * (Number(item.ivaRate || 0) / 100));
}
