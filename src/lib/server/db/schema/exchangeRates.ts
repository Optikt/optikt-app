import {
	pgTable,
	varchar,
	index,
	uniqueIndex,
	uuid,
	timestamp,
	boolean,
	doublePrecision
} from 'drizzle-orm/pg-core';

// ============================================================================
// CURRENCIES
// ============================================================================

/**
 * Available currencies for tracking exchange rates
 * This is a reference table - currencies are predefined in the enum
 */
export const currencies = pgTable(
	'currencies',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		/** Currency code from CurrencyCode enum */
		code: varchar().notNull(),
		/** Display name */
		name: varchar().notNull(),
		/** Currency symbol ($, €, etc) */
		symbol: varchar().notNull().default('$'),
		/** Is this the base currency for sales (USD_BCV) */
		isBase: boolean('is_base').notNull().default(false),
		/** Is this currency active/available */
		isActive: boolean('is_active').notNull().default(true),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		uniqueIndex('ix_currencies_code').using('btree', table.code.asc().nullsLast().op('text_ops')),
		index('ix_currencies_id').using('btree', table.id.asc().nullsLast().op('uuid_ops'))
	]
);

// ============================================================================
// EXCHANGE RATES
// ============================================================================

/**
 * Daily exchange rate records
 * Stores the rate to VES (Bolívares) for each currency on a given date
 */
export const exchangeRates = pgTable(
	'exchange_rates',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		/** Reference to currency */
		currencyId: uuid('currency_id').notNull(),
		/** Rate: how many VES for 1 unit of this currency */
		rateToVes: doublePrecision('rate_to_ves').notNull(),
		/** Effective date of this rate */
		effectiveDate: timestamp('effective_date', { withTimezone: true, mode: 'string' }).notNull(),
		/** Source of the rate (manual, api, etc) */
		source: varchar().notNull().default('manual'),
		/** Optional notes */
		notes: varchar(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_exchange_rates_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_exchange_rates_currency_id').using(
			'btree',
			table.currencyId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_exchange_rates_effective_date').using(
			'btree',
			table.effectiveDate.desc().nullsLast().op('timestamptz_ops')
		),
		// Unique constraint: one rate per currency per date
		uniqueIndex('ix_exchange_rates_currency_date').using(
			'btree',
			table.currencyId.asc().nullsLast().op('uuid_ops'),
			table.effectiveDate.asc().nullsLast().op('timestamptz_ops')
		)
	]
);

// Type exports
export type Currency = typeof currencies.$inferSelect;
export type NewCurrency = typeof currencies.$inferInsert;
export type ExchangeRate = typeof exchangeRates.$inferSelect;
export type NewExchangeRate = typeof exchangeRates.$inferInsert;
