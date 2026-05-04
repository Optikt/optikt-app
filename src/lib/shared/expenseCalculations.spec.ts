import { describe, expect, it } from 'vitest';
import {
	calculateExpenseAmountBcvUsd,
	getExpenseExchangeRateLabel,
	requiresExpenseExchangeRate,
	requiresExpenseRateType
} from './expenseCalculations';

describe('requiresExpenseExchangeRate', () => {
	it('only skips exchange rate for USD expenses', () => {
		expect(requiresExpenseExchangeRate('USD')).toBe(false);
		expect(requiresExpenseExchangeRate('VES')).toBe(true);
		expect(requiresExpenseExchangeRate('USDT')).toBe(true);
		expect(requiresExpenseExchangeRate('EUR')).toBe(true);
	});
});

describe('requiresExpenseRateType', () => {
	it('only requires rate type for VES and EUR', () => {
		expect(requiresExpenseRateType('VES')).toBe(true);
		expect(requiresExpenseRateType('EUR')).toBe(true);
		expect(requiresExpenseRateType('USD')).toBe(false);
		expect(requiresExpenseRateType('USDT')).toBe(false);
	});
});

describe('getExpenseExchangeRateLabel', () => {
	it('uses an audit-friendly USDT label', () => {
		expect(getExpenseExchangeRateLabel('USDT')).toBe('Tasa USDT (Bs/USDT)');
	});
});

describe('calculateExpenseAmountBcvUsd', () => {
	it('keeps USD expenses unchanged', () => {
		expect(calculateExpenseAmountBcvUsd({ currency: 'USD', amount: 25, bcvRate: 36.5 })).toBe(
			25
		);
	});

	it('normalizes VES expenses to USD BCV using the BCV reference', () => {
		expect(
			calculateExpenseAmountBcvUsd({
				currency: 'VES',
				amount: 1825,
				bcvRate: 36.5,
				exchangeRate: 40
			})
		).toBe(50);
	});

	it('converts USDT expenses to USD BCV using both USDT and BCV rates', () => {
		expect(
			calculateExpenseAmountBcvUsd({
				currency: 'USDT',
				amount: 20,
				bcvRate: 36.5,
				exchangeRate: 39.8
			})
		).toBe(21.81);
	});

	it('keeps EUR support as a direct EUR to USD conversion', () => {
		expect(
			calculateExpenseAmountBcvUsd({
				currency: 'EUR',
				amount: 100,
				bcvRate: 36.5,
				exchangeRate: 1.08
			})
		).toBe(108);
	});

	it('returns 0 when a non-USD expense misses its operative rate', () => {
		expect(calculateExpenseAmountBcvUsd({ currency: 'USDT', amount: 20, bcvRate: 36.5 })).toBe(0);
	});
});