import { describe, expect, it } from 'vitest';

import {
	calculateDraftItemSubtotalAlt,
	calculateDraftItemTaxAlt,
	calculateDraftItemTotal,
	calculateDraftItemTotalAlt,
	calculateUnitPurchasePriceFromLineTotal
} from './pricing';
import { createEmptyPurchaseOrderDraftItem } from './defaults';

describe('calculateUnitPurchasePriceFromLineTotal', () => {
	it('derives precise unit purchase price from total cost and quantity', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		item.quantity = 36;
		item.unitPurchasePrice = calculateUnitPurchasePriceFromLineTotal(25, item.quantity);

		expect(item.unitPurchasePrice).toBeCloseTo(25 / 36, 12);
		expect(calculateDraftItemTotal(item)).toBeCloseTo(25, 12);
	});
});

describe('alt currency line totals', () => {
	it('calculates direct Bs totals with per-line IVA rounding', () => {
		const item = createEmptyPurchaseOrderDraftItem();
		item.appliesIva = true;
		item.ivaRate = 16;
		item.quantity = 2;
		item.unitPurchasePriceAlt = 3.14;
		item.unitPurchasePrice = (item.unitPurchasePriceAlt * 1.16) / 100;

		expect(calculateDraftItemSubtotalAlt(item)).toBe(6.28);
		expect(calculateDraftItemTaxAlt(item)).toBe(1);
		expect(calculateDraftItemTotalAlt(item)).toBe(7.28);
	});
});
