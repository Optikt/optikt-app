/**
 * Pure sale totals calculator (no Svelte, no DB).
 *
 * Semantics (see sale-subtotal-semantics spec):
 * - `subtotal` = pre-tax subtotal (BI + exempt), after per-line discounts,
 *   BEFORE the global discount.
 * - `total` = rawSubtotal − globalDiscount — identical to the legacy formula
 *   used by createSale/updateSale, so money amounts never change.
 */

import { DiscountType } from '$lib/shared/enums';
import { decomposePrice } from '$lib/shared/tax';
import { computeDiscount } from '$lib/utils';

export interface SaleTotalsLine {
	unitPrice: number;
	quantity: number;
	discount: number;
	discountType: string;
	isTaxable: boolean;
	taxRate: number;
}

export interface SaleTotals {
	/** Sum of raw line totals (tax-inclusive, post per-line discount). Base for the % global discount. */
	rawSubtotal: number;
	/** Tax-exclusive subtotal (BI + exempt), pre global discount. */
	subtotal: number;
	/** Total IVA from taxable lines (pre global discount). */
	taxAmount: number;
	/** Effective global discount amount. */
	discount: number;
	/** Amount actually charged: max(0, rawSubtotal − discount). */
	total: number;
}

export function computeSaleTotals(
	lines: SaleTotalsLine[],
	globalDiscountValue: number,
	globalDiscountType: string
): SaleTotals {
	const lineTotals: number[] = [];
	let rawSubtotal = 0;

	for (const line of lines) {
		const gross = line.unitPrice * line.quantity;
		const lineDiscount =
			line.discountType === DiscountType.PERCENTAGE ? gross * (line.discount / 100) : line.discount;
		const lineTotal = Math.max(0, gross - lineDiscount);
		lineTotals.push(lineTotal);
		rawSubtotal += lineTotal;
	}

	const discount = computeDiscount(globalDiscountValue, globalDiscountType, rawSubtotal);
	const total = Math.max(0, rawSubtotal - discount);

	let subtotal = 0;
	let taxAmount = 0;

	lines.forEach((line, i) => {
		const lineTotal = lineTotals[i];
		if (line.isTaxable && line.taxRate > 0) {
			const { base, tax } = decomposePrice(lineTotal, line.taxRate);
			subtotal += base;
			taxAmount += tax;
		} else {
			subtotal += lineTotal;
		}
	});

	return { rawSubtotal, subtotal, taxAmount, discount, total };
}

import { SaleItemType } from '$lib/shared/enums/lensTypes';

/**
 * Línea de totales desde un ítem polimórfico de documento (venta o presupuesto).
 * Fuente única (antes duplicada en remote/quotes/helpers y remote/sales/helpers).
 * `isTaxable` default: solo PRODUCT es gravable — misma semántica de subtotal.
 */
export function toSaleTotalsLine(
	item: {
		unitPrice: number;
		quantity: number;
		discount: number;
		discountType: string;
		snapshotIsTaxable?: boolean | null;
		itemType: string;
	},
	taxRate: number
): SaleTotalsLine {
	return {
		unitPrice: item.unitPrice,
		quantity: item.quantity,
		discount: item.discount,
		discountType: item.discountType,
		isTaxable: item.snapshotIsTaxable ?? (item.itemType === SaleItemType.PRODUCT ? true : false),
		taxRate
	};
}
