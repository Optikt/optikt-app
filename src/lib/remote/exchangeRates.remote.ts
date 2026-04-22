/**
 * Exchange Rates Remote Functions
 * Server-side functions for managing currencies and exchange rates
 *
 * TODO: Single server for all exchange rates operations
 */
import { query, command } from '$app/server';
import { requireAuth, requireAdmin } from '$lib/server/guards';
import {
	ListCurrenciesSchema,
	UpsertExchangeRateSchema,
	BatchUpsertRatesSchema,
	GetRatesForDateSchema,
	ExchangeRateIdSchema
} from '$lib/schemas/exchangeRates';
import {
	getActiveCurrencies,
	getAllCurrencies,
	getCurrencyByCode,
	getLatestRates,
	getRatesForDate,
	upsertExchangeRate,
	deleteExchangeRate
} from '$lib/server/db/queries/exchangeRates';
import type { Currency, ExchangeRate } from '$lib/server/db/schema';
import type { ExchangeRateWithCurrency } from '$lib/server/db/queries/exchangeRates';

// ============================================================================
// CURRENCIES
// ============================================================================

/**
 * List all currencies (optionally active only)
 */
export const listCurrencies = query(ListCurrenciesSchema, async (data): Promise<Currency[]> => {
	requireAuth();

	if (data.activeOnly) {
		return getActiveCurrencies();
	}
	return getAllCurrencies();
});

// ============================================================================
// EXCHANGE RATES
// ============================================================================

/**
 * Get the latest rates for all currencies
 */
export const fetchLatestRates = query(async (): Promise<ExchangeRateWithCurrency[]> => {
	requireAuth();

	return getLatestRates();
});

/**
 * Get rates for a specific date
 */
export const fetchRatesForDate = query(
	GetRatesForDateSchema,
	async (data): Promise<ExchangeRateWithCurrency[]> => {
		requireAuth();

		return getRatesForDate(data.date);
	}
);

/**
 * Upsert a single exchange rate for a currency on a date
 */
export const saveExchangeRate = command(
	UpsertExchangeRateSchema,
	async (data): Promise<ExchangeRate> => {
		requireAdmin();

		const currency = await getCurrencyByCode(data.currencyCode);
		if (!currency) {
			throw new Error(`Moneda no encontrada: ${data.currencyCode}`);
		}

		return upsertExchangeRate({
			currencyId: currency.id,
			rateToVes: data.rateToVes,
			effectiveDate: data.effectiveDate,
			source: data.source ?? 'manual',
			notes: data.notes
		});
	}
);

/**
 * Batch upsert rates for multiple currencies on the same date
 * Useful for updating all rates for a given day at once
 */
export const saveBatchRates = command(
	BatchUpsertRatesSchema,
	async (data): Promise<ExchangeRate[]> => {
		requireAdmin();

		const results: ExchangeRate[] = [];

		for (const rate of data.rates) {
			const currency = await getCurrencyByCode(rate.currencyCode);
			if (!currency) {
				throw new Error(`Moneda no encontrada: ${rate.currencyCode}`);
			}

			const result = await upsertExchangeRate({
				currencyId: currency.id,
				rateToVes: rate.rateToVes,
				effectiveDate: data.effectiveDate,
				source: data.source ?? 'manual'
			});
			results.push(result);
		}

		return results;
	}
);

/**
 * Delete an exchange rate entry
 */
export const removeExchangeRate = command(ExchangeRateIdSchema, async (data): Promise<void> => {
	requireAdmin();

	const deleted = await deleteExchangeRate(data.id);
	if (!deleted) {
		throw new Error('Tasa de cambio no encontrada');
	}
});
