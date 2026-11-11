import { describe, expect, it } from 'vitest';
import { buildSaleTaxItems, computeSaleBreakdown, saleBreakdownRows } from './saleBreakdown';

function item(overrides: {
	unitPrice: number;
	quantity?: number;
	discount?: number;
	discountType?: 'FIXED' | 'PERCENTAGE';
	snapshotIsTaxable?: boolean;
}) {
	return {
		unitPrice: overrides.unitPrice,
		quantity: overrides.quantity ?? 1,
		discount: overrides.discount ?? 0,
		discountType: overrides.discountType ?? ('FIXED' as const),
		snapshotIsTaxable: overrides.snapshotIsTaxable ?? false
	};
}

const TAXABLE_100 = item({ unitPrice: 100, snapshotIsTaxable: true });
const EXEMPT_40 = item({ unitPrice: 40 });

describe('computeSaleBreakdown', () => {
	it('decomposes a single taxable line without discount (receipt parity)', () => {
		const bd = computeSaleBreakdown({ total: 100, snapshotTaxRate: 16 }, [TAXABLE_100]);

		// Raw floats, NO rounding anywhere: 100 / 1.16 is kept in full precision.
		expect(bd.taxableBase).toBeCloseTo(100 / 1.16, 10);
		expect(bd.taxAmount).toBeCloseTo(100 - 100 / 1.16, 10);
		expect(bd.subtotalNet + bd.taxAmount).toBeCloseTo(bd.total, 10);
		expect(bd.hasDiscount).toBe(false);
		expect(bd.discountOnBase).toBeCloseTo(0, 10);
	});

	it('splits exempt and taxable lines with no discount', () => {
		const bd = computeSaleBreakdown({ total: 140, snapshotTaxRate: 16 }, [TAXABLE_100, EXEMPT_40]);

		expect(bd.exemptTotal).toBeCloseTo(40, 10);
		expect(bd.taxableBase).toBeCloseTo(100 / 1.16, 10);
		expect(bd.subtotalNet + bd.taxAmount).toBeCloseTo(140, 10);
	});

	it('distributes a FIXED global discount proportionally over gravables y exentas', () => {
		// raw = 140, total = 108 → discount = 32... no: 140 − 10% = 126
		const bd = computeSaleBreakdown({ total: 126, snapshotTaxRate: 16 }, [TAXABLE_100, EXEMPT_40]);

		expect(bd.hasDiscount).toBe(true);
		expect(bd.rawSubtotal).toBeCloseTo(140, 10);
		// Identity: Subtotal − Descuento = Subtotal neto, y neto + IVA = Total.
		expect(bd.subtotalBeforeGlobal - bd.discountOnBase).toBeCloseTo(bd.subtotalNet, 10);
		expect(bd.subtotalNet + bd.taxAmount).toBeCloseTo(bd.total, 10);

		// Proportionality: each line absorbs the discount at the same ratio (10%).
		const taxableBefore = 100 / 1.16;
		const taxableAfter = (100 * 0.9) / 1.16;
		expect(bd.taxableBase).toBeCloseTo(taxableAfter, 10);
		expect(bd.exemptTotal).toBeCloseTo(40 * 0.9, 10);
		expect(taxableBefore - taxableAfter).toBeCloseTo(
			bd.discountOnBase * (taxableBefore / (taxableBefore + 40)),
			6
		);
	});

	it('handles a PERCENTAGE global discount (total = raw × 0.9)', () => {
		const bd = computeSaleBreakdown({ total: 126, snapshotTaxRate: 16 }, [TAXABLE_100, EXEMPT_40]);
		expect(bd.total).toBeCloseTo(bd.rawSubtotal * 0.9, 10);
	});

	it('never rounds lines: keeps >2-decimal precision end to end', () => {
		// A per-line rounding would turn 0.125 into 0.13 — the system must keep 0.125.
		const items = [item({ unitPrice: 0.125, snapshotIsTaxable: true })];
		const bd = computeSaleBreakdown({ total: 0.125, snapshotTaxRate: 16 }, items);

		expect(bd.rawSubtotal).toBeCloseTo(0.125, 12);
		expect(bd.rawSubtotal).not.toBe(0.13); // proof of no 2-decimal rounding
		expect(bd.subtotalNet + bd.taxAmount).toBeCloseTo(0.125, 12);
	});

	it('treats an all-exempt sale without discount (no IVA, no base row)', () => {
		const bd = computeSaleBreakdown({ total: 40, snapshotTaxRate: 16 }, [EXEMPT_40]);
		expect(bd.taxableBase).toBeCloseTo(0, 10);
		expect(bd.taxAmount).toBeCloseTo(0, 10);
		expect(bd.exemptTotal).toBeCloseTo(40, 10);
		expect(bd.hasDiscount).toBe(false);
	});
});

describe('saleBreakdownRows', () => {
	it('omits Subtotal and −Descuento global when there is no global discount', () => {
		const bd = computeSaleBreakdown({ total: 140, snapshotTaxRate: 16 }, [TAXABLE_100, EXEMPT_40]);
		const rows = saleBreakdownRows(bd);

		expect(rows.map((r) => r.key)).toEqual(['base', 'exempt', 'net', 'tax', 'total']);
		expect(rows.find((r) => r.key === 'total')?.amount).toBe(140);
	});

	it('shows the canonical order WITH global discount: Subtotal → −Desc → Base → Exento → Neto → IVA → Total', () => {
		const bd = computeSaleBreakdown({ total: 126, snapshotTaxRate: 16 }, [TAXABLE_100, EXEMPT_40]);
		const rows = saleBreakdownRows(bd);

		expect(rows.map((r) => r.key)).toEqual([
			'subtotal',
			'discount',
			'base',
			'exempt',
			'net',
			'tax',
			'total'
		]);
		expect(rows.find((r) => r.key === 'tax')?.label).toBe('IVA (16%)');
		// Visual chain: Subtotal − Descuento = Neto; Neto + IVA = Total.
		const get = (k: string) => rows.find((r) => r.key === k)!.amount;
		expect(get('subtotal') - get('discount')).toBeCloseTo(get('net'), 10);
		expect(get('net') + get('tax')).toBeCloseTo(get('total'), 10);
	});

	it('hides zero rows (no base when everything is exempt; no IVA when nothing taxable)', () => {
		const bd = computeSaleBreakdown({ total: 40, snapshotTaxRate: 16 }, [EXEMPT_40]);
		const rows = saleBreakdownRows(bd);
		expect(rows.map((r) => r.key)).toEqual(['exempt', 'net', 'total']);
	});

	it('supports the calculator exempt label override', () => {
		const bd = computeSaleBreakdown({ total: 40, snapshotTaxRate: 16 }, [EXEMPT_40]);
		const rows = saleBreakdownRows(bd, { exemptLabel: 'Monto exento' });
		expect(rows.find((r) => r.key === 'exempt')?.label).toBe('Monto exento');
	});
});

describe('buildSaleTaxItems', () => {
	it('maps snapshotIsTaxable null to exempt and forwards the sale tax rate', () => {
		const [t] = buildSaleTaxItems([{ ...item({ unitPrice: 50 }), snapshotIsTaxable: null }], 16);
		expect(t.isTaxable).toBe(false);
		expect(t.taxRate).toBe(16);
		// Fields contract: keeps the TaxableItem input shape stable.
		expect(Object.keys(t).sort()).toEqual(
			['discount', 'discountType', 'isTaxable', 'quantity', 'taxRate', 'unitPrice'].sort()
		);
	});
});
