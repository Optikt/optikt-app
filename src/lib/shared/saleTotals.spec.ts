import { describe, expect, it } from 'vitest';

import { computeSaleTotals, type SaleTotalsLine } from './saleTotals';

function makeLine(overrides: Partial<SaleTotalsLine> = {}): SaleTotalsLine {
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

function goldenLines(): SaleTotalsLine[] {
	return [
		makeLine({ unitPrice: 87, isTaxable: true, taxRate: 16 }),
		makeLine({ unitPrice: 35, isTaxable: false })
	];
}

describe('computeSaleTotals', () => {
	it('golden: 87 taxable (16%) + 35 exempt, no global discount', () => {
		const result = computeSaleTotals(goldenLines(), 0, 'FIXED');
		expect(result.rawSubtotal).toBe(122);
		expect(result.subtotal).toBeCloseTo(110, 2); // 75 (BI) + 35 (exento)
		expect(result.taxAmount).toBeCloseTo(12, 2);
		expect(result.discount).toBe(0);
		expect(result.total).toBe(122);
	});

	it('applies a 10% global discount on the raw subtotal', () => {
		const result = computeSaleTotals(goldenLines(), 10, 'PERCENTAGE');
		expect(result.rawSubtotal).toBe(122);
		expect(result.discount).toBeCloseTo(12.2, 2);
		expect(result.total).toBeCloseTo(109.8, 2);
		// Subtotal is pre global discount: 75 (BI) + 35 (exento) = 110.
		expect(result.subtotal).toBeCloseTo(110, 2);
		// IVA decomposes the raw line (87 → 75 + 12); global discount does not touch it.
		expect(result.taxAmount).toBeCloseTo(12, 2);
	});

	it('applies a FIXED global discount (total = raw − 15)', () => {
		const result = computeSaleTotals(goldenLines(), 15, 'FIXED');
		expect(result.discount).toBe(15);
		expect(result.total).toBe(107);
		expect(result.subtotal).toBeCloseTo(110, 2);
	});

	it('combines per-line PERCENTAGE discount with a global FIXED discount', () => {
		const lines: SaleTotalsLine[] = [
			// 100 − 10% = 90 (taxable 16%)
			makeLine({ unitPrice: 100, discount: 10, discountType: 'PERCENTAGE' }),
			// 50 exempt
			makeLine({ unitPrice: 50, isTaxable: false })
		];
		const result = computeSaleTotals(lines, 14, 'FIXED');
		expect(result.rawSubtotal).toBe(140); // 90 + 50
		expect(result.discount).toBe(14);
		expect(result.total).toBe(126); // 140 − 14
		expect(result.subtotal).toBeCloseTo(127.59, 2); // 90/1.16 (77.59) + 50
		expect(result.taxAmount).toBeCloseTo(12.41, 1);
	});

	it('clamps the total to 0 when the global discount exceeds the raw subtotal', () => {
		const result = computeSaleTotals(
			[makeLine({ unitPrice: 87, isTaxable: false })],
			99999,
			'FIXED'
		);
		expect(result.rawSubtotal).toBe(87);
		expect(result.discount).toBe(99999);
		expect(result.total).toBe(0);
		// Exempt line keeps its full value in the subtotal.
		expect(result.subtotal).toBe(87);
		expect(result.taxAmount).toBe(0);
	});

	it('property: total === rawSubtotal − discount for several inputs', () => {
		const cases: [SaleTotalsLine[], number, string][] = [
			[goldenLines(), 10, 'PERCENTAGE'],
			[
				[
					makeLine({ unitPrice: 100, quantity: 2, discount: 10, discountType: 'PERCENTAGE' }),
					makeLine({ unitPrice: 50, discount: 5, isTaxable: false })
				],
				12,
				'FIXED'
			],
			[[makeLine({ unitPrice: 150, isTaxable: false })], 5, 'PERCENTAGE']
		];

		for (const [lines, discountValue, discountType] of cases) {
			const result = computeSaleTotals(lines, discountValue, discountType);
			expect(result.total).toBeCloseTo(result.rawSubtotal - result.discount, 12);
		}
	});

	it('free line (isTaxable false) adds its full value to subtotal with 0 tax', () => {
		const result = computeSaleTotals(
			[
				makeLine({ unitPrice: 87, isTaxable: true, taxRate: 16 }),
				makeLine({ unitPrice: 150, isTaxable: false })
			],
			0,
			'FIXED'
		);
		expect(result.rawSubtotal).toBe(237);
		expect(result.subtotal).toBeCloseTo(225, 2); // 75 + 150
		expect(result.taxAmount).toBeCloseTo(12, 2);
		expect(result.total).toBe(237);
	});
});
