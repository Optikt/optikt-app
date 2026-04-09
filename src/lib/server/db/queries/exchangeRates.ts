import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '../index';
import { currencies, exchangeRates } from '../schema';
import type { Currency, NewCurrency, ExchangeRate, NewExchangeRate } from '../schema';
import { nowISO } from '$lib/dates';

// ============================================================================
// CURRENCIES
// ============================================================================

export async function getAllCurrencies(): Promise<Currency[]> {
	return db.select().from(currencies).orderBy(currencies.code);
}

export async function getActiveCurrencies(): Promise<Currency[]> {
	return db.select().from(currencies).where(eq(currencies.isActive, true)).orderBy(currencies.code);
}

export async function getCurrencyByCode(code: string): Promise<Currency | undefined> {
	const [currency] = await db.select().from(currencies).where(eq(currencies.code, code)).limit(1);
	return currency;
}

export async function getCurrencyById(id: string): Promise<Currency | undefined> {
	const [currency] = await db.select().from(currencies).where(eq(currencies.id, id)).limit(1);
	return currency;
}

export async function createCurrency(data: NewCurrency): Promise<Currency> {
	const [currency] = await db.insert(currencies).values(data).returning();
	return currency;
}

export async function updateCurrency(
	id: string,
	data: Partial<NewCurrency>
): Promise<Currency | undefined> {
	const [currency] = await db
		.update(currencies)
		.set({ ...data, updatedAt: nowISO() })
		.where(eq(currencies.id, id))
		.returning();
	return currency;
}

// ============================================================================
// EXCHANGE RATES
// ============================================================================

export type ExchangeRateWithCurrency = ExchangeRate & {
	currency: Currency;
};

/**
 * Get all exchange rates for a specific date
 */
export async function getRatesForDate(date: string): Promise<ExchangeRateWithCurrency[]> {
	return db
		.select({
			id: exchangeRates.id,
			currencyId: exchangeRates.currencyId,
			rateToVes: exchangeRates.rateToVes,
			effectiveDate: exchangeRates.effectiveDate,
			source: exchangeRates.source,
			notes: exchangeRates.notes,
			createdAt: exchangeRates.createdAt,
			currency: currencies
		})
		.from(exchangeRates)
		.innerJoin(currencies, eq(exchangeRates.currencyId, currencies.id))
		.where(eq(exchangeRates.effectiveDate, date))
		.orderBy(currencies.code);
}

/**
 * Get the latest rate for each currency
 */
export async function getLatestRates(): Promise<ExchangeRateWithCurrency[]> {
	// Subquery to get the latest date for each currency
	const latestDates = db
		.select({
			currencyId: exchangeRates.currencyId,
			maxDate: sql<string>`MAX(${exchangeRates.effectiveDate})`.as('max_date')
		})
		.from(exchangeRates)
		.groupBy(exchangeRates.currencyId)
		.as('latest');

	return db
		.select({
			id: exchangeRates.id,
			currencyId: exchangeRates.currencyId,
			rateToVes: exchangeRates.rateToVes,
			effectiveDate: exchangeRates.effectiveDate,
			source: exchangeRates.source,
			notes: exchangeRates.notes,
			createdAt: exchangeRates.createdAt,
			currency: currencies
		})
		.from(exchangeRates)
		.innerJoin(currencies, eq(exchangeRates.currencyId, currencies.id))
		.innerJoin(
			latestDates,
			and(
				eq(exchangeRates.currencyId, latestDates.currencyId),
				eq(exchangeRates.effectiveDate, latestDates.maxDate)
			)
		)
		.orderBy(currencies.code);
}

/**
 * Get a specific rate for a currency on a date
 */
export async function getRateForCurrencyOnDate(
	currencyId: string,
	date: string
): Promise<ExchangeRate | undefined> {
	const [rate] = await db
		.select()
		.from(exchangeRates)
		.where(and(eq(exchangeRates.currencyId, currencyId), eq(exchangeRates.effectiveDate, date)))
		.limit(1);
	return rate;
}

/**
 * Get exchange rate history for a currency
 */
export async function getRateHistory(currencyId: string, limit = 30): Promise<ExchangeRate[]> {
	return db
		.select()
		.from(exchangeRates)
		.where(eq(exchangeRates.currencyId, currencyId))
		.orderBy(desc(exchangeRates.effectiveDate))
		.limit(limit);
}

/**
 * Create or update a rate for a specific date (upsert)
 */
export async function upsertExchangeRate(data: NewExchangeRate): Promise<ExchangeRate> {
	const [rate] = await db
		.insert(exchangeRates)
		.values(data)
		.onConflictDoUpdate({
			target: [exchangeRates.currencyId, exchangeRates.effectiveDate],
			set: {
				rateToVes: data.rateToVes,
				source: data.source,
				notes: data.notes
			}
		})
		.returning();
	return rate;
}

/**
 * Create exchange rate
 */
export async function createExchangeRate(data: NewExchangeRate): Promise<ExchangeRate> {
	const [rate] = await db.insert(exchangeRates).values(data).returning();
	return rate;
}

/**
 * Delete exchange rate
 */
export async function deleteExchangeRate(id: string): Promise<boolean> {
	const result = await db.delete(exchangeRates).where(eq(exchangeRates.id, id)).returning();
	return result.length > 0;
}
