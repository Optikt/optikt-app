/**
 * Tax utilities for IVA-inclusive pricing.
 *
 * All prices in the system are **tax-inclusive** — the sale price IS what
 * the customer pays. These helpers decompose that price into base + tax
 * for display and reporting purposes.
 */

/** Decompose a tax-inclusive price into base and tax amounts. */
export function decomposePrice(
	price: number,
	taxRate: number
): { base: number; tax: number } {
	if (taxRate <= 0) return { base: price, tax: 0 };
	const base = price / (1 + taxRate / 100);
	const tax = price - base;
	return { base, tax };
}

export interface TaxableItem {
	unitPrice: number;
	quantity: number;
	discount: number;
	discountType: 'FIXED' | 'PERCENTAGE';
	isTaxable: boolean;
	taxRate: number;
}

export interface TaxBreakdown {
	/** Sum of base amounts for taxable items (price without IVA) */
	taxableBase: number;
	/** Sum of exempt item totals (no IVA) */
	exemptTotal: number;
	/** Total IVA amount */
	taxAmount: number;
	/** Grand total (taxableBase + taxAmount + exemptTotal) — should equal sum of all line totals */
	total: number;
}

function lineTotal(item: TaxableItem): number {
	const gross = item.unitPrice * item.quantity;
	if (item.discountType === 'PERCENTAGE') {
		return gross - gross * (item.discount / 100);
	}
	return gross - item.discount;
}

/** Compute a full tax breakdown from a list of items. */
export function computeTaxBreakdown(items: TaxableItem[]): TaxBreakdown {
	let taxableBase = 0;
	let exemptTotal = 0;
	let taxAmount = 0;

	for (const item of items) {
		const total = lineTotal(item);
		if (item.isTaxable && item.taxRate > 0) {
			const { base, tax } = decomposePrice(total, item.taxRate);
			taxableBase += base;
			taxAmount += tax;
		} else {
			exemptTotal += total;
		}
	}

	return {
		taxableBase,
		exemptTotal,
		taxAmount,
		total: taxableBase + taxAmount + exemptTotal
	};
}
