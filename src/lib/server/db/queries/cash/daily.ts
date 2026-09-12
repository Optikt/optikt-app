/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: daily breakdown.
 */
/**
 * Cash & Expenses queries
 *
 * - CRUD for `cash_expenses` (operational outflows)
 * - On-the-fly P&L report (delivery-based revenue + cash collected + COGS + expenses)
 * - Daily breakdown for tables / CSV export
 * - Pipeline snapshot for in-progress (PENDING) sales
 *
 * Revenue recognition: a sale is recognized when it transitions to COMPLETED
 * (i.e. fully paid + delivered). The `sales.completed_at` column anchors it.
 * Cash collected is independent and uses `sale_payments.payment_date`.
 *
 * All queries accept `executor: DbOrTx = db` so they can run standalone or
 * inside a transaction (see AGENTS.md transaction pattern).
 */
import { and, eq, gte, isNull, isNotNull, lte, sql, sum, count } from 'drizzle-orm';
import { db } from '../../index';
import { cashExpenses, sales, saleItems, salePayments } from '../../schema';
import type { DbOrTx } from '../../types';

import { getExchangeVarianceRows, getPurchaseDiscountEarnedRows } from './report';

// ============================================================================
// DAILY BREAKDOWN
// ============================================================================

export interface DailyBreakdownRow {
	date: string; // YYYY-MM-DD
	revenue: number;
	otherIncome: number;
	collected: number;
	cogs: number;
	expenses: number;
	purchaseDiscountsEarned: number;
	exchangeSettlementVariance: number;
	grossProfit: number;
	netProfit: number;
	salesCount: number;
}

/**
 * Per-day aggregation across the same metrics as `getCashReport`. Buckets are
 * computed in the database via `date_trunc('day', ...)` and merged in JS
 * (one map keyed by date string).
 */
export async function getDailyBreakdown(
	args: { from: string; to: string },
	executor: DbOrTx = db
): Promise<DailyBreakdownRow[]> {
	const { from, to } = args;
	const dayKey = (d: unknown) => sql<string>`to_char(${d}, 'YYYY-MM-DD')`;

	const [
		revenueRows,
		retainedRows,
		collectedRows,
		cogsRows,
		expensesRows,
		purchaseDiscountRows,
		exchangeVarianceRows
	] = await Promise.all([
		executor
			.select({
				day: dayKey(sql`date_trunc('day', ${sales.completedAt})`),
				total: sum(sales.total),
				cnt: count()
			})
			.from(sales)
			.where(
				and(
					isNull(sales.deletedAt),
					sql`${sales.status} = 'COMPLETED'`,
					isNotNull(sales.completedAt),
					gte(sales.completedAt, from),
					lte(sales.completedAt, to)
				)
			)
			.groupBy(sql`date_trunc('day', ${sales.completedAt})`),

		executor
			.select({
				day: dayKey(sql`date_trunc('day', ${sales.cancelledAt})`),
				total: sum(sales.refundAmount)
			})
			.from(sales)
			.where(
				and(
					isNull(sales.deletedAt),
					sql`${sales.status} = 'CANCELLED'`,
					sql`${sales.refundStatus} = 'RETAINED'`,
					isNotNull(sales.cancelledAt),
					gte(sales.cancelledAt, from),
					lte(sales.cancelledAt, to)
				)
			)
			.groupBy(sql`date_trunc('day', ${sales.cancelledAt})`),

		executor
			.select({
				day: dayKey(sql`date_trunc('day', ${salePayments.paymentDate})`),
				total: sum(salePayments.amountBcvUsd)
			})
			.from(salePayments)
			.innerJoin(sales, eq(salePayments.saleId, sales.id))
			.where(
				and(
					isNull(salePayments.voidedAt),
					isNull(sales.deletedAt),
					gte(salePayments.paymentDate, from),
					lte(salePayments.paymentDate, to)
				)
			)
			.groupBy(sql`date_trunc('day', ${salePayments.paymentDate})`),

		executor
			.select({
				day: dayKey(sql`date_trunc('day', ${sales.completedAt})`),
				total: sum(saleItems.snapshotCostTotal)
			})
			.from(saleItems)
			.innerJoin(sales, eq(saleItems.saleId, sales.id))
			.where(
				and(
					isNull(sales.deletedAt),
					isNull(saleItems.deletedAt),
					sql`${sales.status} = 'COMPLETED'`,
					isNotNull(sales.completedAt),
					gte(sales.completedAt, from),
					lte(sales.completedAt, to),
					isNotNull(saleItems.snapshotCostTotal)
				)
			)
			.groupBy(sql`date_trunc('day', ${sales.completedAt})`),

		executor
			.select({
				day: dayKey(sql`date_trunc('day', ${cashExpenses.expenseDate})`),
				total: sum(cashExpenses.amountUsd)
			})
			.from(cashExpenses)
			.where(
				and(
					isNull(cashExpenses.voidedAt),
					gte(cashExpenses.expenseDate, from),
					lte(cashExpenses.expenseDate, to)
				)
			)
			.groupBy(sql`date_trunc('day', ${cashExpenses.expenseDate})`),

		getPurchaseDiscountEarnedRows(args, executor),
		getExchangeVarianceRows(args, executor)
	]);

	type Bucket = {
		date: string;
		revenue: number;
		otherIncome: number;
		collected: number;
		cogs: number;
		expenses: number;
		purchaseDiscountsEarned: number;
		exchangeSettlementVariance: number;
		salesCount: number;
	};
	const buckets = new Map<string, Bucket>();
	const ensure = (date: string): Bucket => {
		let b = buckets.get(date);
		if (!b) {
			b = {
				date,
				revenue: 0,
				otherIncome: 0,
				collected: 0,
				cogs: 0,
				expenses: 0,
				purchaseDiscountsEarned: 0,
				exchangeSettlementVariance: 0,
				salesCount: 0
			};
			buckets.set(date, b);
		}
		return b;
	};

	for (const r of revenueRows) {
		const b = ensure(r.day);
		b.revenue = Number(r.total ?? 0);
		b.salesCount = Number(r.cnt ?? 0);
	}
	for (const r of retainedRows) ensure(r.day).otherIncome = Number(r.total ?? 0);
	for (const r of collectedRows) ensure(r.day).collected = Number(r.total ?? 0);
	for (const r of cogsRows) ensure(r.day).cogs = Number(r.total ?? 0);
	for (const r of expensesRows) ensure(r.day).expenses = Number(r.total ?? 0);
	for (const r of purchaseDiscountRows) ensure(r.date).purchaseDiscountsEarned = r.total;
	for (const r of exchangeVarianceRows) ensure(r.date).exchangeSettlementVariance = r.total;

	return Array.from(buckets.values())
		.map((b) => ({
			...b,
			grossProfit: b.revenue + b.otherIncome - b.cogs,
			netProfit:
				b.revenue +
				b.otherIncome +
				b.purchaseDiscountsEarned +
				b.exchangeSettlementVariance -
				b.cogs -
				b.expenses
		}))
		.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
