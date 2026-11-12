/**
 * Pure breakdown helpers for the sale detail view (hero) and the invoice calculator.
 *
 * Display math mirrors the receipt (`receiptData.ts` / `ReceiptSummaryGrid`):
 * same helpers, same canonical row order, no formulas of our own. The stored
 * `sale.total` is always the amount actually charged (raw lines − global
 * discount); the breakdown decomposes it for display only.
 *
 * Money rules (verified):
 * - No per-line rounding anywhere: everything runs on raw floats, formatting
 *   happens at paint time. Never sum pre-rounded lines.
 * - The global discount is distributed proportionally over tax-inclusive lines
 *   by `computeAdjustedTaxBreakdown` (gravables y exentas por igual).
 */

import { computeAdjustedTaxBreakdown } from '../helpers/taxBreakdown';
import { computeTaxBreakdown, type TaxableItem } from '$lib/shared/tax';
import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';

export interface BreakdownSaleInput {
	/** Stored total (after global discount) — the amount actually charged. */
	total: number;
	/** Sale-level IVA rate snapshot (e.g. 16). */
	snapshotTaxRate: number;
}

export interface SaleBreakdown {
	/** Tax-exclusive subtotal BEFORE the global discount (row "Subtotal"). Only meaningful with a discount. */
	subtotalBeforeGlobal: number;
	/** Global discount in tax-exclusive terms (row "− Descuento global"). */
	discountOnBase: number;
	hasDiscount: boolean;
	/** Sum of adjusted taxable lines' base (without IVA). */
	taxableBase: number;
	/** Sum of adjusted exempt lines' totals. */
	exemptTotal: number;
	/** taxableBase + exemptTotal (row "Subtotal neto"). */
	subtotalNet: number;
	/** Total IVA of adjusted taxable lines. */
	taxAmount: number;
	taxRate: number;
	/** Stored sale.total (row "Total"). */
	total: number;
	/** Sum of raw line totals tax-inclusive, after per-line discounts, before global discount. */
	rawSubtotal: number;
}

export interface SaleBreakdownRow {
	key: 'subtotal' | 'discount' | 'base' | 'exempt' | 'net' | 'tax' | 'total';
	label: string;
	amount: number;
}

/** Map persisted sale items to the shared TaxableItem shape (single source: receipt parity). */
export function buildSaleTaxItems(
	items: Pick<
		SaleItemWithDetails,
		'unitPrice' | 'quantity' | 'discount' | 'discountType' | 'snapshotIsTaxable'
	>[],
	taxRate: number
): TaxableItem[] {
	return items.map((item) => ({
		unitPrice: item.unitPrice,
		quantity: item.quantity,
		discount: item.discount,
		discountType: item.discountType as 'FIXED' | 'PERCENTAGE',
		isTaxable: item.snapshotIsTaxable ?? false,
		taxRate
	}));
}

/** Compute the display breakdown for a sale. `discountAmount` follows the receipt's derivation. */
export function computeSaleBreakdown(
	sale: BreakdownSaleInput,
	items: Pick<
		SaleItemWithDetails,
		'unitPrice' | 'quantity' | 'discount' | 'discountType' | 'snapshotIsTaxable'
	>[]
): SaleBreakdown {
	const taxItems = buildSaleTaxItems(items, sale.snapshotTaxRate);
	const rawSubtotal = computeTaxBreakdown(taxItems).total;
	const discountAmount = Math.max(0, rawSubtotal - sale.total);
	const adjusted = computeAdjustedTaxBreakdown(taxItems, discountAmount);
	const discountOnBase =
		adjusted.subtotalBeforeGlobal - adjusted.taxableBase - adjusted.exemptTotal;

	return {
		subtotalBeforeGlobal: adjusted.subtotalBeforeGlobal,
		discountOnBase,
		hasDiscount: discountAmount > 0.01,
		taxableBase: adjusted.taxableBase,
		exemptTotal: adjusted.exemptTotal,
		subtotalNet: adjusted.taxableBase + adjusted.exemptTotal,
		taxAmount: adjusted.taxAmount,
		taxRate: sale.snapshotTaxRate,
		total: sale.total,
		rawSubtotal
	};
}

export interface BreakdownRowsOptions {
	/** Label for the exempt row: "Exento" (hero/receipt) or "Monto exento" (calculator). */
	exemptLabel?: string;
}

/**
 * Canonical receipt row order:
 * WITH global discount: Subtotal → − Descuento global → Base imponible → Exento → Subtotal neto → IVA (%) → Total.
 * WITHOUT discount: the two first rows are omitted (Subtotal equals Subtotal neto then).
 * Zero rows (base/exempt/IVA) are omitted, same as the receipt.
 */
export function saleBreakdownRows(
	breakdown: SaleBreakdown,
	{ exemptLabel = 'Exento' }: BreakdownRowsOptions = {}
): SaleBreakdownRow[] {
	const rows: SaleBreakdownRow[] = [];
	const fmtRate = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 });

	if (breakdown.hasDiscount && breakdown.discountOnBase > 0.01) {
		rows.push({ key: 'subtotal', label: 'Subtotal', amount: breakdown.subtotalBeforeGlobal });
		rows.push({ key: 'discount', label: '− Descuento global', amount: breakdown.discountOnBase });
	}
	if (breakdown.taxableBase > 0.01) {
		rows.push({ key: 'base', label: 'Base imponible', amount: breakdown.taxableBase });
	}
	if (breakdown.exemptTotal > 0.01) {
		rows.push({ key: 'exempt', label: exemptLabel, amount: breakdown.exemptTotal });
	}
	rows.push({ key: 'net', label: 'Subtotal neto', amount: breakdown.subtotalNet });
	if (breakdown.taxAmount > 0.01) {
		rows.push({
			key: 'tax',
			label: `IVA (${fmtRate.format(breakdown.taxRate)}%)`,
			amount: breakdown.taxAmount
		});
	}
	rows.push({ key: 'total', label: 'Total', amount: breakdown.total });
	return rows;
}
