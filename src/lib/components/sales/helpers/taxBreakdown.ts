/**
 * Tax helpers for the sale wizard.
 * Pure functions that build tax inputs and compute tax breakdowns.
 */

import type { ProductWithRelations } from '$lib/server/db/queries/products';
import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
import { DiscountType } from '$lib/shared/enums';
import {
	DEFAULT_TAX_RATE,
	decomposePrice,
	type TaxBreakdown,
	type TaxableItem
} from '$lib/shared/tax';
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
		} else if (item.kind === 'free') {
			// Free items (promo / gift) are always exempt — they have no isTaxable field.
			result.push({
				unitPrice: item.unitPrice,
				quantity: item.quantity,
				discount: item.discount,
				discountType: item.discountType,
				isTaxable: false,
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

/**
 * Tax breakdown with an extra field: the TAX-EXCLUSIVE subtotal (base of
 * taxable lines + full exempt lines) BEFORE the global discount is applied.
 * Used by the Step 3 summary so the "Subtotal" row shows the pre-tax,
 * pre-discount value (e.g. base 75 + exempt 35 = 110 for a $87 frame + $35 lens).
 *
 * The `*BeforeDiscount` fields expose the same tax-exclusive breakdown
 * (base / exempt / IVA) computed on the un-discounted lines, so the card can
 * render: Subtotal → Base imponible / Exento → IVA → Descuento → Total,
 * where Total = Base + Exento + IVA − Descuento.
 */
export type AdjustedTaxBreakdown = TaxBreakdown & {
	subtotalBeforeGlobal: number;
	/** Pre-discount taxable base (IVA excluded). */
	taxableBaseBeforeDiscount: number;
	/** Pre-discount exempt total. */
	exemptTotalBeforeDiscount: number;
	/** Pre-discount (gross) IVA. */
	taxAmountBeforeDiscount: number;
};

/**
 * Compute the tax breakdown of a list of items after applying a global
 * discount proportionally, clamping the discount to the subtotal.
 *
 * `subtotalBeforeGlobal` and the `*BeforeDiscount` fields are the pre-discount
 * tax-exclusive values for display. The discount math itself runs on the raw
 * (tax-inclusive) line totals so the ratio/clamp behavior is unchanged.
 */
export function computeAdjustedTaxBreakdown(
	itemsForTax: TaxableItem[],
	globalDiscountValue: number
): AdjustedTaxBreakdown {
	const rawSubtotalBeforeGlobal = itemsForTax.reduce((sum, item) => {
		const gross = item.unitPrice * item.quantity;
		const lineDiscount =
			item.discountType === DiscountType.PERCENTAGE ? gross * (item.discount / 100) : item.discount;
		return sum + Math.max(0, gross - lineDiscount);
	}, 0);

	const discountRatio =
		rawSubtotalBeforeGlobal > 0
			? Math.min(Math.max(globalDiscountValue, 0), rawSubtotalBeforeGlobal) /
				rawSubtotalBeforeGlobal
			: 0;

	let taxableBase = 0;
	let exemptTotal = 0;
	let taxAmount = 0;
	let subtotalBeforeGlobal = 0;
	let taxableBaseBeforeDiscount = 0;
	let exemptTotalBeforeDiscount = 0;
	let taxAmountBeforeDiscount = 0;

	for (const item of itemsForTax) {
		const gross = item.unitPrice * item.quantity;
		const lineDiscount =
			item.discountType === DiscountType.PERCENTAGE ? gross * (item.discount / 100) : item.discount;
		const lineAfterLocalDiscount = Math.max(0, gross - lineDiscount);
		const adjustedLineTotal = lineAfterLocalDiscount * (1 - discountRatio);

		if (item.isTaxable && item.taxRate > 0) {
			const { base, tax } = decomposePrice(adjustedLineTotal, item.taxRate);
			taxableBase += base;
			taxAmount += tax;
			// Pre-discount, tax-exclusive contribution = base of the unadjusted line.
			const { base: baseBefore, tax: taxBefore } = decomposePrice(
				lineAfterLocalDiscount,
				item.taxRate
			);
			taxableBaseBeforeDiscount += baseBefore;
			taxAmountBeforeDiscount += taxBefore;
			subtotalBeforeGlobal += baseBefore;
		} else {
			exemptTotal += adjustedLineTotal;
			exemptTotalBeforeDiscount += lineAfterLocalDiscount;
			subtotalBeforeGlobal += lineAfterLocalDiscount;
		}
	}

	return {
		taxableBase,
		exemptTotal,
		taxAmount,
		total: taxableBase + exemptTotal + taxAmount,
		subtotalBeforeGlobal,
		taxableBaseBeforeDiscount,
		exemptTotalBeforeDiscount,
		taxAmountBeforeDiscount
	};
}
