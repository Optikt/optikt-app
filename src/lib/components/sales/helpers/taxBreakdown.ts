/**
 * Tax helpers for the sale wizard.
 * Pure functions that build tax inputs and compute tax breakdowns.
 */

import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import { DEFAULT_TAX_RATE, decomposePrice, type TaxableItem } from '$lib/shared/tax';
import { computeDiscount } from '$lib/utils';

import type { SaleItemRow } from '../newSaleTypes';

/** Build TaxableItem[] from wizard items for use with computeTaxBreakdown. */
export function buildTaxItemsFromWizard(
	items: SaleItemRow[],
	products: ProductWithRelations[],
	lensItems: LensCatalogItemWithRelations[],
	defaultTaxRate: number = DEFAULT_TAX_RATE
): TaxableItem[] {
	const result: TaxableItem[] = [];
	for (const item of items) {
		if (item.kind === 'product') {
			const product = products.find((p) => p.id === item.productId);
			result.push({
				unitPrice: item.unitPrice,
				quantity: item.quantity,
				discount: item.discount,
				discountType: item.discountType,
				isTaxable: product?.isTaxable ?? true,
				taxRate: defaultTaxRate
			});
		} else if (item.kind === 'lens') {
			const lens = lensItems.find((l) => l.id === item.lensPair.catalogItemId);
			result.push({
				unitPrice: item.unitPrice,
				quantity: 1,
				discount: item.discount,
				discountType: item.discountType,
				isTaxable: lens?.isTaxable ?? false,
				taxRate: defaultTaxRate
			});
		} else if (item.kind === 'treatment') {
			result.push({
				unitPrice: item.unitPrice,
				quantity: item.quantity,
				discount: item.discount,
				discountType: item.discountType,
				isTaxable: item.isTaxable,
				taxRate: defaultTaxRate
			});
		}
	}
	return result;
}

/** Compute tax breakdown from stored snapshot fields on persisted items. */
export function computeSnapshotTaxBreakdown(
	items: {
		unitPrice: number;
		quantity: number;
		discount: number;
		discountType: string;
		snapshotIsTaxable: boolean | null;
	}[],
	documentTaxRate: number | null
): { taxableBase: number; exemptTotal: number; taxAmount: number } {
	let taxableBase = 0;
	let exemptTotal = 0;
	let taxAmount = 0;
	const taxRate = documentTaxRate ?? 0;

	for (const item of items) {
		const lineTotal =
			item.unitPrice * item.quantity -
			computeDiscount(item.discount, item.discountType, item.unitPrice * item.quantity);
		const isTaxable = item.snapshotIsTaxable ?? false;

		if (isTaxable && taxRate > 0) {
			const { base, tax } = decomposePrice(lineTotal, taxRate);
			taxableBase += base;
			taxAmount += tax;
		} else {
			exemptTotal += lineTotal;
		}
	}

	return { taxableBase, exemptTotal, taxAmount };
}

export function getSnapshotTaxLabel(documentTaxRate: number | null): string | null {
	if (documentTaxRate == null || documentTaxRate <= 0) {
		return null;
	}

	const formatter = new Intl.NumberFormat('es-VE', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2
	});

	return `IVA (${formatter.format(documentTaxRate)}%)`;
}
