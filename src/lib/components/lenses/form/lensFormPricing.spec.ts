import { describe, expect, it } from 'vitest';
import { LensPriceType } from '$lib/shared/enums/lensTypes';
import { calculateLensPricing, type LensPricingInput } from './lensFormPricing';

function input(overrides: Partial<LensPricingInput> = {}): LensPricingInput {
	return {
		basePrice: '50',
		mountingPrice: '10',
		shippingPrice: '5',
		salePrice: '150',
		priceType: LensPriceType.PAIR,
		...overrides
	};
}

describe('calculateLensPricing', () => {
	it('doubles unit base price into pair purchase price', () => {
		const result = calculateLensPricing(input({ priceType: LensPriceType.UNIT }));

		expect(result.pairPurchasePrice).toBe(100);
		expect(result.operationalCost).toBe(115);
		expect(result.grossProfit).toBe(35);
		expect(result.marginPercent).toBeCloseTo((35 / 150) * 100);
		expect(result.totalWithTax).toBe(150);
	});

	it('keeps pair base price as is', () => {
		const result = calculateLensPricing(input());

		expect(result.pairPurchasePrice).toBe(50);
		expect(result.operationalCost).toBe(65);
		expect(result.grossProfit).toBe(85);
	});

	it('returns null profit without sale price', () => {
		const result = calculateLensPricing(input({ salePrice: '' }));

		expect(result.grossProfit).toBeNull();
		expect(result.marginPercent).toBeNull();
		expect(result.totalWithTax).toBe(0);
	});

	it('treats blank costs as zero', () => {
		const result = calculateLensPricing(
			input({ basePrice: '', mountingPrice: '', shippingPrice: '' })
		);

		expect(result.operationalCost).toBe(0);
		expect(result.grossProfit).toBe(150);
	});
});
