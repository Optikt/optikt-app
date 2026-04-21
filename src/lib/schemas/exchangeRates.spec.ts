import { describe, it, expect } from 'vitest';
import {
	ExchangeRateIdSchema,
	ListCurrenciesSchema,
	UpsertExchangeRateSchema,
	BatchUpsertRatesSchema,
	GetRatesForDateSchema
} from '$lib/schemas/exchangeRates';

// ── Helpers ─────────────────────────────────────────────────────────────

function makeRate(overrides: Record<string, unknown> = {}) {
	return {
		currencyCode: 'USD_BCV',
		rateToVes: 36.5,
		effectiveDate: '2024-06-15',
		source: 'manual',
		...overrides
	};
}

// ── ExchangeRateIdSchema ────────────────────────────────────────────────

describe('ExchangeRateIdSchema', () => {
	it('accepts a valid UUID', () => {
		const result = ExchangeRateIdSchema.safeParse({ id: crypto.randomUUID() });
		expect(result.success).toBe(true);
	});

	it('rejects invalid UUID', () => {
		const result = ExchangeRateIdSchema.safeParse({ id: 'nope' });
		expect(result.success).toBe(false);
	});
});

// ── ListCurrenciesSchema ────────────────────────────────────────────────

describe('ListCurrenciesSchema', () => {
	it('defaults activeOnly to true', () => {
		const result = ListCurrenciesSchema.safeParse({});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.activeOnly).toBe(true);
		}
	});

	it('accepts explicit activeOnly false', () => {
		const result = ListCurrenciesSchema.safeParse({ activeOnly: false });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.activeOnly).toBe(false);
		}
	});
});

// ── UpsertExchangeRateSchema ────────────────────────────────────────────

describe('UpsertExchangeRateSchema', () => {
	it('accepts a valid rate', () => {
		const result = UpsertExchangeRateSchema.safeParse(makeRate());
		expect(result.success).toBe(true);
	});

	it('defaults source to manual when omitted', () => {
		const { source: _, ...rest } = makeRate();
		const result = UpsertExchangeRateSchema.safeParse(rest);
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.source).toBe('manual');
		}
	});

	it('rejects invalid currency code', () => {
		const result = UpsertExchangeRateSchema.safeParse(makeRate({ currencyCode: 'INVALID' }));
		expect(result.success).toBe(false);
	});

	it('rejects rate less than 0.01', () => {
		const result = UpsertExchangeRateSchema.safeParse(makeRate({ rateToVes: 0 }));
		expect(result.success).toBe(false);
	});

	it('rejects invalid date format', () => {
		const result = UpsertExchangeRateSchema.safeParse(makeRate({ effectiveDate: '15/06/2024' }));
		expect(result.success).toBe(false);
	});

	it('coerces string rateToVes to number', () => {
		const result = UpsertExchangeRateSchema.safeParse(makeRate({ rateToVes: '42.5' }));
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.rateToVes).toBe(42.5);
		}
	});

	it('accepts all valid currency codes', () => {
		for (const code of ['USD_BCV', 'EUR_BCV', 'USDT', 'USD_PAYPAL']) {
			const result = UpsertExchangeRateSchema.safeParse(makeRate({ currencyCode: code }));
			expect(result.success).toBe(true);
		}
	});

	it('allows optional notes', () => {
		const result = UpsertExchangeRateSchema.safeParse(makeRate({ notes: 'BCV rate' }));
		expect(result.success).toBe(true);
	});
});

// ── BatchUpsertRatesSchema ──────────────────────────────────────────────

describe('BatchUpsertRatesSchema', () => {
	it('accepts a valid batch of rates', () => {
		const result = BatchUpsertRatesSchema.safeParse({
			rates: [
				{ currencyCode: 'USD_BCV', rateToVes: 36.5 },
				{ currencyCode: 'EUR_BCV', rateToVes: 40.2 }
			],
			effectiveDate: '2024-06-15'
		});
		expect(result.success).toBe(true);
	});

	it('defaults source to manual', () => {
		const result = BatchUpsertRatesSchema.safeParse({
			rates: [{ currencyCode: 'USDT', rateToVes: 36.0 }],
			effectiveDate: '2024-06-15'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.source).toBe('manual');
		}
	});

	it('rejects invalid currency code in batch', () => {
		const result = BatchUpsertRatesSchema.safeParse({
			rates: [{ currencyCode: 'FAKE', rateToVes: 10 }],
			effectiveDate: '2024-06-15'
		});
		expect(result.success).toBe(false);
	});

	it('rejects missing effectiveDate', () => {
		const result = BatchUpsertRatesSchema.safeParse({
			rates: [{ currencyCode: 'USD_BCV', rateToVes: 36.5 }]
		});
		expect(result.success).toBe(false);
	});
});

// ── GetRatesForDateSchema ───────────────────────────────────────────────

describe('GetRatesForDateSchema', () => {
	it('accepts a valid ISO date', () => {
		const result = GetRatesForDateSchema.safeParse({ date: '2024-06-15' });
		expect(result.success).toBe(true);
	});

	it('rejects invalid date format', () => {
		const result = GetRatesForDateSchema.safeParse({ date: 'June 15' });
		expect(result.success).toBe(false);
	});

	it('rejects missing date', () => {
		const result = GetRatesForDateSchema.safeParse({});
		expect(result.success).toBe(false);
	});
});
