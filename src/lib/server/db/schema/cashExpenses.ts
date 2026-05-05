import {
	pgTable,
	varchar,
	index,
	uuid,
	timestamp,
	doublePrecision,
	foreignKey
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import type { ExpenseCategory, ExpenseCurrency, RateType } from '../../../shared/enums/cashTypes';

// ============================================================================
// CASH EXPENSES
// ============================================================================

/**
 * Operational cash expenses (rent, salaries, utilities, taxes, etc.)
 * Independent from purchase orders / inventory acquisitions.
 *
 * - All amounts are stored in their native currency (`amount`) AND converted
 *   to USD BCV (`amountUsd`) as a snapshot at registration time. The snapshot is
 *   immutable: changing exchange rates later does NOT recompute past expenses.
 * - Records are never hard-deleted; use `voidedAt` for cancellation. Voided
 *   rows are excluded from totals but kept for audit.
 */
export const cashExpenses = pgTable(
	'cash_expenses',
	{
		id: uuid().primaryKey().notNull().defaultRandom(),
		/** Free-form category from `ExpenseCategory` (string union, not pgEnum). */
		category: varchar({ length: 50 }).notNull().$type<ExpenseCategory>(),
		description: varchar({ length: 500 }).notNull(),
		/** Native currency used for the payment (USD | VES | USDT | EUR). */
		currency: varchar({ length: 10 }).notNull().$type<ExpenseCurrency>(),
		/** Amount in the native currency. */
		amount: doublePrecision().notNull(),
		/** Snapshot equivalent in USD BCV at the moment of registration (server-computed). */
		amountUsd: doublePrecision('amount_usd').notNull(),
		/**
		 * Method-specific exchange rate captured for audit.
		 * - USD: null (native amount already equals USD BCV).
		 * - VES: operative rate Bs per 1 USD (BCV, parallel, etc.).
		 * - USDT: rate Bs per 1 USDT.
		 * - EUR: direct EUR→USD conversion used at registration time.
		 */
		exchangeRate: doublePrecision('exchange_rate'),
		/**
		 * BCV official Bs/USD rate at the moment of registration. Stored for
		 * auditability even when not strictly needed for the conversion.
		 */
		bcvRate: doublePrecision('bcv_rate'),
		/** 'BCV' | 'PARALLEL' | 'DIRECT'. Null when currency is USD. */
		rateType: varchar('rate_type', { length: 20 }).$type<RateType>(),
		/** Date of the actual expense (may differ from createdAt). */
		expenseDate: timestamp('expense_date', { withTimezone: true, mode: 'string' }).notNull(),
		/** User who registered the expense. */
		registeredById: uuid('registered_by_id').notNull(),
		reference: varchar({ length: 100 }),
		notes: varchar({ length: 1000 }),
		// --- Soft-delete / void ---
		voidedAt: timestamp('voided_at', { withTimezone: true, mode: 'string' }),
		voidedById: uuid('voided_by_id'),
		voidReason: varchar('void_reason', { length: 500 }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_cash_expenses_id').using('btree', table.id.asc().nullsLast().op('uuid_ops')),
		index('ix_cash_expenses_expense_date').using(
			'btree',
			table.expenseDate.desc().nullsLast().op('timestamptz_ops')
		),
		index('ix_cash_expenses_category').using(
			'btree',
			table.category.asc().nullsLast().op('text_ops')
		),
		index('ix_cash_expenses_registered_by').using(
			'btree',
			table.registeredById.asc().nullsLast().op('uuid_ops')
		),
		// Partial index for the hot path (active expenses ordered by date).
		index('ix_cash_expenses_active_by_date')
			.using('btree', table.expenseDate.desc().nullsLast().op('timestamptz_ops'))
			.where(sql`${table.voidedAt} IS NULL`),
		foreignKey({
			columns: [table.registeredById],
			foreignColumns: [users.id],
			name: 'cash_expenses_registered_by_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.voidedById],
			foreignColumns: [users.id],
			name: 'cash_expenses_voided_by_id_fkey'
		}).onDelete('set null')
	]
);

// Type exports
export type CashExpense = typeof cashExpenses.$inferSelect;
export type NewCashExpense = typeof cashExpenses.$inferInsert;
