import { describe, it, expect } from 'vitest';
import { decomposePrice, computeTaxBreakdown, type TaxableItem } from './tax';

// ============================================================================
// decomposePrice
// ============================================================================

describe('decomposePrice', () => {
	it('decomposes a standard 16% IVA price', () => {
		const { base, tax } = decomposePrice(116, 16);
		expect(base).toBeCloseTo(100, 2);
		expect(tax).toBeCloseTo(16, 2);
	});

	it('decomposes a 12% tax rate', () => {
		const { base, tax } = decomposePrice(112, 12);
		expect(base).toBeCloseTo(100, 2);
		expect(tax).toBeCloseTo(12, 2);
	});

	it('returns full price as base when taxRate is 0', () => {
		const { base, tax } = decomposePrice(100, 0);
		expect(base).toBe(100);
		expect(tax).toBe(0);
	});

	it('returns full price as base when taxRate is negative', () => {
		const { base, tax } = decomposePrice(100, -5);
		expect(base).toBe(100);
		expect(tax).toBe(0);
	});

	it('handles zero price', () => {
		const { base, tax } = decomposePrice(0, 16);
		expect(base).toBe(0);
		expect(tax).toBe(0);
	});

	it('sum of base + tax equals original price', () => {
		const price = 250;
		const { base, tax } = decomposePrice(price, 16);
		expect(base + tax).toBeCloseTo(price, 10);
	});
});

// ============================================================================
// computeTaxBreakdown
// ============================================================================

describe('computeTaxBreakdown', () => {
	function makeItem(overrides: Partial<TaxableItem> = {}): TaxableItem {
		return {
			unitPrice: 100,
			quantity: 1,
			discount: 0,
			discountType: 'FIXED',
			isTaxable: true,
			taxRate: 16,
			...overrides
		};
	}

	it('computes breakdown for a single taxable item', () => {
		const result = computeTaxBreakdown([makeItem({ unitPrice: 116 })]);
		expect(result.taxableBase).toBeCloseTo(100, 2);
		expect(result.taxAmount).toBeCloseTo(16, 2);
		expect(result.exemptTotal).toBe(0);
		expect(result.total).toBeCloseTo(116, 2);
	});

	it('computes breakdown for a single exempt item', () => {
		const result = computeTaxBreakdown([
			makeItem({ unitPrice: 100, isTaxable: false })
		]);
		expect(result.taxableBase).toBe(0);
		expect(result.taxAmount).toBe(0);
		expect(result.exemptTotal).toBe(100);
		expect(result.total).toBe(100);
	});

	it('handles mixed taxable and exempt items', () => {
		const items: TaxableItem[] = [
			makeItem({ unitPrice: 116, isTaxable: true, taxRate: 16 }),
			makeItem({ unitPrice: 200, isTaxable: false })
		];
		const result = computeTaxBreakdown(items);
		expect(result.taxableBase).toBeCloseTo(100, 2);
		expect(result.taxAmount).toBeCloseTo(16, 2);
		expect(result.exemptTotal).toBe(200);
		expect(result.total).toBeCloseTo(316, 2);
	});

	it('applies fixed discount correctly', () => {
		const result = computeTaxBreakdown([
			makeItem({ unitPrice: 116, discount: 16, discountType: 'FIXED' })
		]);
		// Line total = 116 - 16 = 100, which at 16% tax → base ~86.21, tax ~13.79
		expect(result.total).toBeCloseTo(100, 2);
		expect(result.taxableBase).toBeCloseTo(86.21, 1);
		expect(result.taxAmount).toBeCloseTo(13.79, 1);
	});

	it('applies percentage discount correctly', () => {
		const result = computeTaxBreakdown([
			makeItem({ unitPrice: 100, discount: 10, discountType: 'PERCENTAGE' })
		]);
		// Line total = 100 - 10% = 90, at 16% tax → base ~77.59, tax ~12.41
		expect(result.total).toBeCloseTo(90, 2);
		expect(result.taxableBase + result.taxAmount).toBeCloseTo(90, 2);
	});

	it('handles multiple quantities', () => {
		const result = computeTaxBreakdown([
			makeItem({ unitPrice: 50, quantity: 3, isTaxable: false })
		]);
		expect(result.exemptTotal).toBe(150);
		expect(result.total).toBe(150);
	});

	it('returns zeroes for empty items array', () => {
		const result = computeTaxBreakdown([]);
		expect(result.taxableBase).toBe(0);
		expect(result.taxAmount).toBe(0);
		expect(result.exemptTotal).toBe(0);
		expect(result.total).toBe(0);
	});

	it('total equals sum of all line totals', () => {
		const items: TaxableItem[] = [
			makeItem({ unitPrice: 116, isTaxable: true, taxRate: 16 }),
			makeItem({ unitPrice: 200, isTaxable: false }),
			makeItem({ unitPrice: 58, quantity: 2, isTaxable: true, taxRate: 16 })
		];
		const result = computeTaxBreakdown(items);
		const expectedTotal = 116 + 200 + 58 * 2;
		expect(result.total).toBeCloseTo(expectedTotal, 2);
	});

	it('treats taxable item with 0% rate as exempt', () => {
		const result = computeTaxBreakdown([
			makeItem({ unitPrice: 100, isTaxable: true, taxRate: 0 })
		]);
		expect(result.taxableBase).toBe(0);
		expect(result.taxAmount).toBe(0);
		expect(result.exemptTotal).toBe(100);
	});
});
