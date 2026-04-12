import { describe, it, expect } from 'vitest';
import {
	CurrencyCode,
	CURRENCY_LABELS,
	getCurrencyLabel,
	CURRENCY_SYMBOLS,
	BASE_CURRENCY,
	isBaseCurrency,
	ALL_CURRENCY_CODES
} from './currencyTypes';

describe('CurrencyCode enum', () => {
	it('has all expected values', () => {
		expect(CurrencyCode.USD_BCV).toBe('USD_BCV');
		expect(CurrencyCode.EUR_BCV).toBe('EUR_BCV');
		expect(CurrencyCode.USDT).toBe('USDT');
		expect(CurrencyCode.USD_PAYPAL).toBe('USD_PAYPAL');
	});

	it('ALL_CURRENCY_CODES contains all values', () => {
		expect(ALL_CURRENCY_CODES).toHaveLength(4);
		expect(ALL_CURRENCY_CODES).toContain(CurrencyCode.USD_BCV);
		expect(ALL_CURRENCY_CODES).toContain(CurrencyCode.EUR_BCV);
		expect(ALL_CURRENCY_CODES).toContain(CurrencyCode.USDT);
		expect(ALL_CURRENCY_CODES).toContain(CurrencyCode.USD_PAYPAL);
	});
});

describe('getCurrencyLabel', () => {
	it('returns display labels for known currency codes', () => {
		expect(getCurrencyLabel('USD_BCV')).toBe('USD (BCV)');
		expect(getCurrencyLabel('EUR_BCV')).toBe('EUR (BCV)');
		expect(getCurrencyLabel('USDT')).toBe('USDT');
		expect(getCurrencyLabel('USD_PAYPAL')).toBe('USD PayPal');
	});

	it('has a label for every code in the enum', () => {
		for (const code of ALL_CURRENCY_CODES) {
			expect(CURRENCY_LABELS[code]).toBeDefined();
		}
	});

	it('returns raw value for unknown code', () => {
		expect(getCurrencyLabel('BTC')).toBe('BTC');
	});

	it('returns raw value for empty string', () => {
		expect(getCurrencyLabel('')).toBe('');
	});
});

describe('CURRENCY_SYMBOLS', () => {
	it('has a symbol for every currency code', () => {
		for (const code of ALL_CURRENCY_CODES) {
			expect(CURRENCY_SYMBOLS[code]).toBeDefined();
		}
	});

	it('returns correct symbols', () => {
		expect(CURRENCY_SYMBOLS[CurrencyCode.USD_BCV]).toBe('$');
		expect(CURRENCY_SYMBOLS[CurrencyCode.EUR_BCV]).toBe('€');
		expect(CURRENCY_SYMBOLS[CurrencyCode.USDT]).toBe('$');
		expect(CURRENCY_SYMBOLS[CurrencyCode.USD_PAYPAL]).toBe('$');
	});
});

describe('BASE_CURRENCY', () => {
	it('is USD_BCV', () => {
		expect(BASE_CURRENCY).toBe(CurrencyCode.USD_BCV);
	});
});

describe('isBaseCurrency', () => {
	it('returns true for USD_BCV', () => {
		expect(isBaseCurrency(CurrencyCode.USD_BCV)).toBe(true);
	});

	it('returns false for non-base currencies', () => {
		expect(isBaseCurrency(CurrencyCode.EUR_BCV)).toBe(false);
		expect(isBaseCurrency(CurrencyCode.USDT)).toBe(false);
		expect(isBaseCurrency(CurrencyCode.USD_PAYPAL)).toBe(false);
	});
});
