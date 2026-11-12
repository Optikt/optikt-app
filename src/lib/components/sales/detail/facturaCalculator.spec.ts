import { describe, expect, it } from 'vitest';
import { formatPrice } from '$lib/utils';
import { computeSaleBreakdown } from './saleBreakdown';
import {
	computeInvoiceCalculation,
	invoiceSummaryText,
	type InvoiceItemInput,
	type InvoiceSaleInput
} from './facturaCalculator';

const SALE: InvoiceSaleInput = { discount: 0, discountType: 'FIXED', taxRate: 16 };
const RATE = 900;

function item(overrides: Partial<InvoiceItemInput> & { unitPrice: number }): InvoiceItemInput {
	return {
		name: 'Item',
		rxSummary: null,
		quantity: 1,
		discount: 0,
		discountType: 'FIXED',
		isTaxable: false,
		...overrides
	};
}

describe('computeInvoiceCalculation', () => {
	it('splits a taxable line into base/IVA at the chosen rate (tax-inclusive math)', () => {
		const calc = computeInvoiceCalculation({
			items: [item({ unitPrice: 116, isTaxable: true })],
			sale: SALE,
			rate: RATE,
			rateOk: true
		});
		const [line] = calc.lines;

		expect(line.base).toBeCloseTo(100, 10);
		expect(line.iva).toBeCloseTo(16, 10);
		expect(line.baseBs).toBeCloseTo(100 * RATE, 6);
		expect(line.ivaBs).toBeCloseTo(16 * RATE, 6);
		expect(line.totalBs).toBeCloseTo(116 * RATE, 6);
		expect(calc.totals.totalBs).toBeCloseTo(line.totalBs, 6);
	});

	it('treats exempt lines as pure base and shows them in Monto exento', () => {
		const calc = computeInvoiceCalculation({
			items: [item({ unitPrice: 40, isTaxable: false })],
			sale: SALE,
			rate: RATE,
			rateOk: true
		});
		expect(calc.lines[0].iva).toBe(0);
		expect(calc.totals.exemptBs).toBeCloseTo(40 * RATE, 6);
		expect(calc.totals.ivaBs).toBeCloseTo(0, 6);
		// "Base imponible" is the TAXABLE base only — exempt amounts live in "Monto exento".
		expect(calc.totals.baseBs).toBeCloseTo(0, 6);
	});

	it('distributes the global discount proportionally (gravables y exentas), no rounding', () => {
		const items = [
			item({ name: 'Montura', unitPrice: 116, isTaxable: true }),
			item({ name: 'Servicio', unitPrice: 40, isTaxable: false })
		];
		// Header discount FIXED 15.6 over raw 156 → 10%.
		const calc = computeInvoiceCalculation({
			items,
			sale: { discount: 15.6, discountType: 'FIXED', taxRate: 16 },
			rate: RATE,
			rateOk: true
		});

		expect(calc.totals.discount).toBeCloseTo(15.6, 10);
		// Each line absorbed exactly 10%.
		expect(calc.lines[0].usdNet).toBeCloseTo(116 * 0.9, 10);
		expect(calc.lines[1].usdNet).toBeCloseTo(40 * 0.9, 10);
		// Identity: net + IVA = total; total = (raw − discount) × rate.
		expect(calc.totals.netBs + calc.totals.ivaBs).toBeCloseTo(calc.totals.totalBs, 6);
		expect(calc.totals.totalBs).toBeCloseTo((156 - 15.6) * RATE, 6);
		// Proportional: base+exempt split preserves the tax decomposition of each line.
		expect(calc.lines[0].base + calc.lines[0].iva).toBeCloseTo(116 * 0.9, 10);
	});

	it('agrees with computeSaleBreakdown for the same inputs (single money formula)', () => {
		const items = [
			item({ unitPrice: 100, isTaxable: true }),
			item({ unitPrice: 40, isTaxable: false })
		];
		const saleForBreakdown = { total: 140, snapshotTaxRate: 16 };
		const breakdown = computeSaleBreakdown(
			saleForBreakdown,
			items.map((i) => ({
				unitPrice: i.unitPrice,
				quantity: i.quantity,
				discount: i.discount,
				discountType: i.discountType as 'FIXED' | 'PERCENTAGE',
				snapshotIsTaxable: i.isTaxable
			}))
		);
		const calc = computeInvoiceCalculation({
			items,
			sale: SALE,
			rate: RATE,
			rateOk: true
		});

		expect(calc.totals.baseBs / RATE).toBeCloseTo(breakdown.taxableBase, 6);
		expect(calc.totals.exemptBs / RATE).toBeCloseTo(breakdown.exemptTotal, 6);
		expect(calc.totals.ivaBs / RATE).toBeCloseTo(breakdown.taxAmount, 6);
		expect(calc.totals.usdNet).toBeCloseTo(breakdown.total, 6);
	});

	it('keeps full float precision (no 2-decimal rounding in the math)', () => {
		const calc = computeInvoiceCalculation({
			items: [item({ unitPrice: 0.125, isTaxable: false })],
			sale: SALE,
			rate: 1,
			rateOk: true
		});
		expect(calc.totals.totalBs).not.toBe(0.13);
		expect(calc.totals.totalBs).toBeCloseTo(0.125, 12);
	});

	it('passes rateOk through as the UI error flag while math keeps the fallback rate', () => {
		const calc = computeInvoiceCalculation({
			items: [item({ unitPrice: 10, isTaxable: false })],
			sale: SALE,
			rate: 850,
			rateOk: false
		});
		expect(calc.ok).toBe(false);
		expect(calc.rate).toBe(850);
		expect(calc.totals.totalBs).toBeCloseTo(8500, 6);
	});

	it('handles PERCENTAGE global discount over the raw subtotal', () => {
		const calc = computeInvoiceCalculation({
			items: [item({ unitPrice: 100, isTaxable: false })],
			sale: { discount: 10, discountType: 'PERCENTAGE', taxRate: 16 },
			rate: RATE,
			rateOk: true
		});
		expect(calc.totals.discount).toBeCloseTo(10, 10);
		expect(calc.totals.totalBs).toBeCloseTo(90 * RATE, 6);
	});
});

describe('invoiceSummaryText', () => {
	it('builds the plain-text summary in Bs. with lines and totals', () => {
		const calc = computeInvoiceCalculation({
			items: [
				item({ name: 'Montura GIO', unitPrice: 116, isTaxable: true }),
				item({ name: 'Servicio', unitPrice: 40, isTaxable: false })
			],
			sale: { discount: 15.6, discountType: 'FIXED', taxRate: 16 },
			rate: RATE,
			rateOk: true
		});
		const text = invoiceSummaryText(calc, { orderNumber: '#0292', rateModeLabel: 'actual' });

		expect(text).toContain('Factura referencial (no fiscal) · Venta #0292');
		expect(text).toContain('Montura GIO | Gravable | Base ');
		expect(text).toContain('Servicio | Exento | Base ');
		expect(text).toContain('Descuento global');
		expect(text).toContain('Base imponible');
		expect(text).toContain('Monto exento');
		expect(text).toContain('Subtotal neto');
		expect(text).toContain('Total Bs. ');
		// NBSP-safe: the USD reference uses the canonical money formatter.
		expect(text).toContain(`(${formatPrice(140.4)})`);
		// IVA label uses the es-VE decimal comma for fractional rates.
		expect(text).toContain('IVA (16%)');
	});
});
