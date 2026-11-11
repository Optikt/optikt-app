/**
 * Invoice calculator (factura manual) — PURE, display-only.
 *
 * Nothing here is fiscal or persisted: it helps the cashier compute the Bs.
 * equivalent of the sale for a manual invoice, at a chosen rate.
 *
 * Money rules (mirrors the business math — never fork it):
 * - No rounding anywhere: raw float line math, formatted only at paint time.
 * - Global discount distributed proportionally over tax-inclusive lines
 *   (gravables y exentas), same as `computeAdjustedTaxBreakdown`.
 * - Tax-inclusive price: base = line ÷ (1 + IVA), IVA = line − base.
 */

import { computeDiscount, formatCurrency, formatPrice } from '$lib/utils';
import { decomposePrice } from '$lib/shared/tax';

export type InvoiceRateMode = 'sale' | 'today' | 'custom';

export interface InvoiceItemInput {
	name: string;
	/** Collapsed prescription line (lens rows), e.g. "OD +1.50 · OI +1.00". */
	rxSummary?: string | null;
	quantity: number;
	unitPrice: number;
	discount: number;
	discountType: string;
	isTaxable: boolean;
}

export interface InvoiceSaleInput {
	/** Global discount raw value (sale.discount). */
	discount: number;
	discountType: string;
	/** IVA rate snapshot (e.g. 16). */
	taxRate: number;
}

export interface InvoiceLineResult {
	name: string;
	rxSummary: string | null;
	taxable: boolean;
	/** USD value of the line after per-line discount, before the global discount. */
	usd: number;
	base: number;
	iva: number;
	/** Tax-inclusive USD value after the global discount (base + iva). */
	usdNet: number;
	/** Bs. equivalents at the chosen rate. */
	baseBs: number;
	ivaBs: number;
	totalBs: number;
}

export interface InvoiceTotals {
	/** Σ raw line totals (tax-incl, after per-line discounts, before global discount). */
	subtotalRaw: number;
	/** `subtotalRaw` at the chosen rate (Bs.). */
	subtotalRawBs: number;
	/** Global discount amount (raw value, effective over the raw subtotal). */
	discount: number;
	/** `discount` at the chosen rate (Bs.). */
	discountBs: number;
	baseBs: number;
	exemptBs: number;
	netBs: number;
	ivaBs: number;
	totalBs: number;
	/** Referencia en USD: rawSubtotal − global discount. */
	usdNet: number;
}

export interface InvoiceCalculation {
	/** Effective rate used (chosen mode, or the reference when custom is invalid). */
	rate: number;
	/** False when the custom rate is unusable (fallback rate applied while showing the error). */
	ok: boolean;
	lines: InvoiceLineResult[];
	totals: InvoiceTotals;
	taxRate: number;
}

export interface ComputeInvoiceInput {
	items: InvoiceItemInput[];
	sale: InvoiceSaleInput;
	/** Chosen rate (mode resolution happens in the UI). */
	rate: number;
	/** True when `rate` is usable (> 0). */
	rateOk: boolean;
}

function rawLineTotal(item: InvoiceItemInput): number {
	const gross = item.unitPrice * item.quantity;
	return Math.max(0, gross - computeDiscount(item.discount, item.discountType, gross));
}

export function computeInvoiceCalculation({
	items,
	sale,
	rate,
	rateOk
}: ComputeInvoiceInput): InvoiceCalculation {
	// `rate` is what the UI resolved (chosen rate, or the reference fallback when a
	// custom rate is invalid — the error strip comes from `ok`, math never stops).
	const effectiveRate = rate;

	const lineValues = items.map((item) => ({
		item,
		lineAfterLocal: rawLineTotal(item)
	}));
	const rawSubtotal = lineValues.reduce((sum, l) => sum + l.lineAfterLocal, 0);

	// Effective global discount (percentage resolves over the raw subtotal, FIXED as-is).
	const discount = Math.min(
		rawSubtotal,
		Math.max(0, computeDiscount(sale.discount, sale.discountType, rawSubtotal))
	);
	const ratio = rawSubtotal > 0 ? 1 - discount / rawSubtotal : 1;

	let baseBs = 0;
	let exemptBs = 0;
	let ivaBs = 0;
	let totalBs = 0;
	let usdNetTotal = 0;

	const lines: InvoiceLineResult[] = lineValues.map(({ item, lineAfterLocal }) => {
		const usd = lineAfterLocal;
		const adjustedUsd = lineAfterLocal * ratio;

		let base: number;
		let iva: number;
		if (item.isTaxable && sale.taxRate > 0) {
			const decomposed = decomposePrice(adjustedUsd, sale.taxRate);
			base = decomposed.base;
			iva = decomposed.tax;
		} else {
			base = adjustedUsd;
			iva = 0;
		}
		const usdNet = base + iva;

		const lineBaseBs = base * effectiveRate;
		const lineIvaBs = iva * effectiveRate;
		const lineTotalBs = usdNet * effectiveRate;

		if (item.isTaxable && sale.taxRate > 0) {
			baseBs += lineBaseBs;
		} else {
			exemptBs += lineBaseBs;
		}
		ivaBs += lineIvaBs;
		totalBs += lineTotalBs;
		usdNetTotal += usdNet;

		return {
			name: item.name,
			rxSummary: item.rxSummary ?? null,
			taxable: item.isTaxable && sale.taxRate > 0,
			usd,
			base,
			iva,
			usdNet,
			baseBs: lineBaseBs,
			ivaBs: lineIvaBs,
			totalBs: lineTotalBs
		};
	});

	return {
		rate: effectiveRate,
		ok: rateOk,
		lines,
		totals: {
			subtotalRaw: rawSubtotal,
			subtotalRawBs: rawSubtotal * effectiveRate,
			discount,
			discountBs: discount * effectiveRate,
			baseBs,
			exemptBs,
			netBs: baseBs + exemptBs,
			ivaBs,
			totalBs,
			usdNet: usdNetTotal
		},
		taxRate: sale.taxRate
	};
}

/** Plain-text summary for «Copiar resumen» (2-decimal display values, es-VE commas). */
export function invoiceSummaryText(
	calculation: InvoiceCalculation,
	context: { orderNumber: string; rateModeLabel: string }
): string {
	const { totals, lines, taxRate } = calculation;
	const money = (value: number) => formatCurrency(value);
	const header = `Factura referencial (no fiscal) · Venta ${context.orderNumber} · Tasa ${money(calculation.rate)} (${context.rateModeLabel})`;
	const rows = lines.map(
		(line) =>
			`${line.name} | ${line.taxable ? 'Gravable' : 'Exento'} | Base ${money(line.baseBs)} | IVA ${money(
				line.ivaBs
			)} | Total ${money(line.totalBs)}`
	);
	const totalsLines = [
		...(totals.discount > 0.01
			? [`Subtotal ${money(totals.subtotalRawBs)}`, `Descuento global −${money(totals.discountBs)}`]
			: []),
		`Base imponible ${money(totals.baseBs)}`,
		`Monto exento ${money(totals.exemptBs)}`,
		`Subtotal neto ${money(totals.netBs)}`,
		`IVA (${new Intl.NumberFormat('es-VE', { maximumFractionDigits: 2 }).format(taxRate)}%) ${money(totals.ivaBs)}`,
		`Total Bs. ${money(totals.totalBs)} (${formatPrice(totals.usdNet)})`
	];
	return [header, ...rows, ...totalsLines].join('\n');
}
