import { describe, expect, it } from 'vitest';
import { calculateSettlementGrossAmount } from './purchaseOrderCurrencies';

describe('calculateSettlementGrossAmount', () => {
	it('adds IVA to native settlement amounts (alt prices are pre-tax)', () => {
		expect(
			calculateSettlementGrossAmount(
				[
					{
						quantity: 2,
						unitPurchasePrice: 17.4,
						unitPurchasePriceAlt: 15,
						appliesIva: true,
						ivaRate: 16
					}
				],
				true
			)
		).toBe(34.8);
	});

	it('keeps exempt native lines tax-free', () => {
		expect(
			calculateSettlementGrossAmount(
				[
					{
						quantity: 1,
						unitPurchasePrice: 15,
						unitPurchasePriceAlt: 15,
						appliesIva: false,
						ivaRate: 16
					}
				],
				true
			)
		).toBe(15);
	});

	it('uses the tax-included USD price for USD settlements', () => {
		expect(
			calculateSettlementGrossAmount(
				[
					{
						quantity: 2,
						unitPurchasePrice: 17.4,
						unitPurchasePriceAlt: 15,
						appliesIva: true,
						ivaRate: 16
					}
				],
				false
			)
		).toBe(34.8);
	});
});
