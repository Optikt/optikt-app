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
import { and, asc, desc, eq, gte, isNull, isNotNull, lte, sql, sum, count } from 'drizzle-orm';
import { db } from '../index';
import {
	cashExpenses,
	purchaseOrderEarlyPaymentBenefits,
	purchaseOrderPayments,
	purchaseOrders,
	sales,
	saleItems,
	salePayments,
	users,
	type CashExpense,
	type NewCashExpense
} from '../schema';
import type { DbOrTx } from '../types';
import { nowISO } from '$lib/dates';
import { PurchaseOrderStatus, type ExpenseCategory } from '$lib/shared/enums';

interface PurchaseDiscountEarnedRow {
	date: string;
	total: number;
}

interface ExchangeVarianceRow {
	date: string;
	total: number;
}

// ============================================================================
// CASH EXPENSE: CRUD
// ============================================================================

export async function createExpense(
	data: NewCashExpense,
	executor: DbOrTx = db
): Promise<CashExpense> {
	const now = nowISO();
	const [row] = await executor
		.insert(cashExpenses)
		.values({ ...data, createdAt: now, updatedAt: now })
		.returning();
	return row;
}

export async function findExpenseById(
	id: string,
	executor: DbOrTx = db
): Promise<CashExpense | null> {
	const [row] = await executor.select().from(cashExpenses).where(eq(cashExpenses.id, id)).limit(1);
	return row ?? null;
}

/** Soft-delete an expense. Returns null if it was already voided or not found. */
export async function voidExpense(
	id: string,
	voidedById: string,
	voidReason: string,
	executor: DbOrTx = db
): Promise<CashExpense | null> {
	const now = nowISO();
	const [row] = await executor
		.update(cashExpenses)
		.set({ voidedAt: now, voidedById, voidReason, updatedAt: now })
		.where(and(eq(cashExpenses.id, id), isNull(cashExpenses.voidedAt)))
		.returning();
	return row ?? null;
}

export type ExpenseListRow = CashExpense & {
	registeredByName: string | null;
};

export interface ListExpensesArgs {
	from: string;
	to: string;
	category?: ExpenseCategory;
	includeVoided?: boolean;
}

export async function listExpenses(
	args: ListExpensesArgs,
	executor: DbOrTx = db
): Promise<ExpenseListRow[]> {
	const filters = [
		gte(cashExpenses.expenseDate, args.from),
		lte(cashExpenses.expenseDate, args.to)
	];
	if (args.category) filters.push(eq(cashExpenses.category, args.category));
	if (!args.includeVoided) filters.push(isNull(cashExpenses.voidedAt));

	const rows = await executor
		.select({
			expense: cashExpenses,
			registeredByName: users.fullName
		})
		.from(cashExpenses)
		.leftJoin(users, eq(cashExpenses.registeredById, users.id))
		.where(and(...filters))
		.orderBy(desc(cashExpenses.expenseDate));

	return rows.map((r) => ({ ...r.expense, registeredByName: r.registeredByName }));
}

// ============================================================================
// CASH REPORT (P&L)
// ============================================================================

export interface CashReport {
	// Realized revenue (sales delivered = status COMPLETED, by completedAt)
	grossRevenue: number;
	salesCount: number;
	// Otros ingresos: anticipos retenidos al cancelar (refund_status = RETAINED).
	// Bucketed by `cancelledAt`. No tienen COGS asociado (la mercancía no se entregó).
	otherIncome: number;
	retainedSalesCount: number;
	// Caja (paymentDate) — independent cash flow
	totalCollected: number;
	paymentsCount: number;
	// COGS — sum of snapshotCostTotal for delivered sales
	totalCogs: number;
	cogsIncomplete: boolean;
	// Egresos
	totalExpenses: number;
	expensesCount: number;
	expensesByCategory: Array<{ category: ExpenseCategory; total: number }>;
	// Ingreso financiero independiente del inventario / margen bruto
	purchaseDiscountsEarned: number;
	// Resultado cambiario por liquidaciones en distinta moneda
	exchangeSettlementVariance: number;
	// Resultados
	grossProfit: number;
	grossMarginPct: number;
	netProfit: number;
}

async function getPurchaseDiscountEarnedRows(
	args: { from: string; to: string },
	executor: DbOrTx = db
): Promise<PurchaseDiscountEarnedRow[]> {
	const { from, to } = args;
	const rows = await executor
		.select({
			date: purchaseOrderEarlyPaymentBenefits.benefitDate,
			total: sum(purchaseOrderEarlyPaymentBenefits.amountUsdBcv)
		})
		.from(purchaseOrderEarlyPaymentBenefits)
		.innerJoin(
			purchaseOrders,
			eq(purchaseOrderEarlyPaymentBenefits.purchaseOrderId, purchaseOrders.id)
		)
		.where(
			and(
				isNull(purchaseOrderEarlyPaymentBenefits.voidedAt),
				eq(purchaseOrderEarlyPaymentBenefits.appliedToBalance, true),
				isNull(purchaseOrders.deletedAt),
				eq(purchaseOrders.status, PurchaseOrderStatus.CONFIRMED),
				gte(purchaseOrderEarlyPaymentBenefits.benefitDate, from),
				lte(purchaseOrderEarlyPaymentBenefits.benefitDate, to)
			)
		)
		.groupBy(purchaseOrderEarlyPaymentBenefits.benefitDate);

	return rows.map((row) => ({ date: row.date, total: Number(row.total ?? 0) }));
}

async function getExchangeVarianceRows(
	args: { from: string; to: string },
	executor: DbOrTx = db
): Promise<ExchangeVarianceRow[]> {
	const { from, to } = args;
	const rows = await executor
		.select({
			date: sql<string>`to_char(${purchaseOrderPayments.paymentDate}, 'YYYY-MM-DD')`,
			total: sum(
				sql`${purchaseOrderPayments.amountAppliedToDebtUsdBcvAtOrder} - ${purchaseOrderPayments.amountUsdBcv}`
			)
		})
		.from(purchaseOrderPayments)
		.innerJoin(purchaseOrders, eq(purchaseOrderPayments.purchaseOrderId, purchaseOrders.id))
		.where(
			and(
				isNull(purchaseOrderPayments.voidedAt),
				isNull(purchaseOrders.deletedAt),
				eq(purchaseOrders.status, PurchaseOrderStatus.CONFIRMED),
				gte(purchaseOrderPayments.paymentDate, from),
				lte(purchaseOrderPayments.paymentDate, to)
			)
		)
		.groupBy(sql`to_char(${purchaseOrderPayments.paymentDate}, 'YYYY-MM-DD')`);

	return rows.map((row) => ({ date: row.date, total: Number(row.total ?? 0) }));
}

/**
 * Compute the P&L for a date range based on **delivered** sales.
 *
 * - Revenue / COGS: only sales with `status = 'COMPLETED'`, bucketed by `completedAt`.
 * - Collected: `sale_payments.amountBcvUsd` by `paymentDate`, excluding voided
 *   payments and cancelled / soft-deleted sales (independent of completion).
 * - Expenses: voided expenses excluded.
 *
 * COGS uses `snapshotCostTotal` (NULL items are excluded; `cogsIncomplete`
 * flags when this happens).
 */
export async function getCashReport(
	args: { from: string; to: string },
	executor: DbOrTx = db
): Promise<CashReport> {
	const { from, to } = args;

	const [
		revenueRow,
		retainedRow,
		collectedRow,
		cogsRow,
		incompleteCogsRow,
		expensesRow,
		expensesByCategoryRows,
		purchaseDiscountRows,
		exchangeVarianceRows
	] = await Promise.all([
		// Revenue (delivery-based) — COMPLETED sales whose completedAt falls in range
		executor
			.select({
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
			.then(([r]) => ({ total: Number(r.total ?? 0), cnt: Number(r.cnt ?? 0) })),

		// Otros ingresos — anticipos retenidos al cancelar. Bucketed by cancelledAt.
		executor
			.select({
				total: sum(sales.refundAmount),
				cnt: count()
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
			.then(([r]) => ({ total: Number(r.total ?? 0), cnt: Number(r.cnt ?? 0) })),

		// Collected (caja) — sale_payments.amountBcvUsd in range, non-voided.
		// We intentionally include payments from CANCELLED sales: the cash did
		// physically arrive. If it was later refunded, that refund is logged as
		// a cash_expenses row (category REFUND) which offsets it on the egress
		// side, preserving an auditable trail.
		executor
			.select({
				total: sum(salePayments.amountBcvUsd),
				cnt: count()
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
			.then(([r]) => ({ total: Number(r.total ?? 0), cnt: Number(r.cnt ?? 0) })),

		// COGS — sum of snapshotCostTotal for non-null items in COMPLETED sales
		executor
			.select({ total: sum(saleItems.snapshotCostTotal) })
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
			.then(([r]) => Number(r.total ?? 0)),

		// COGS-incomplete flag — count of saleItems with NULL snapshotCostTotal
		executor
			.select({ cnt: count() })
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
					isNull(saleItems.snapshotCostTotal)
				)
			)
			.then(([r]) => Number(r.cnt ?? 0)),

		// Expenses total + count
		executor
			.select({
				total: sum(cashExpenses.amountUsd),
				cnt: count()
			})
			.from(cashExpenses)
			.where(
				and(
					isNull(cashExpenses.voidedAt),
					gte(cashExpenses.expenseDate, from),
					lte(cashExpenses.expenseDate, to)
				)
			)
			.then(([r]) => ({ total: Number(r.total ?? 0), cnt: Number(r.cnt ?? 0) })),

		// Expenses grouped by category
		executor
			.select({
				category: cashExpenses.category,
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
			.groupBy(cashExpenses.category)
			.orderBy(desc(sum(cashExpenses.amountUsd))),

		getPurchaseDiscountEarnedRows(args, executor),
		getExchangeVarianceRows(args, executor)
	]);

	const grossRevenue = revenueRow.total;
	const otherIncome = retainedRow.total;
	const totalIncome = grossRevenue + otherIncome;
	const totalCogs = cogsRow;
	const totalExpenses = expensesRow.total;
	const purchaseDiscountsEarned = purchaseDiscountRows.reduce((sum, row) => sum + row.total, 0);
	const exchangeSettlementVariance = exchangeVarianceRows.reduce((sum, row) => sum + row.total, 0);
	const grossProfit = totalIncome - totalCogs;
	const grossMarginPct = totalIncome > 0 ? (grossProfit / totalIncome) * 100 : 0;

	return {
		grossRevenue,
		salesCount: revenueRow.cnt,
		otherIncome,
		retainedSalesCount: retainedRow.cnt,
		totalCollected: collectedRow.total,
		paymentsCount: collectedRow.cnt,
		totalCogs,
		cogsIncomplete: incompleteCogsRow > 0,
		totalExpenses,
		expensesCount: expensesRow.cnt,
		expensesByCategory: expensesByCategoryRows.map((r) => ({
			category: r.category as ExpenseCategory,
			total: Number(r.total ?? 0)
		})),
		purchaseDiscountsEarned,
		exchangeSettlementVariance,
		grossProfit,
		grossMarginPct,
		netProfit: grossProfit - totalExpenses + purchaseDiscountsEarned + exchangeSettlementVariance
	};
}

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

	const [revenueRows, retainedRows, collectedRows, cogsRows, expensesRows, purchaseDiscountRows, exchangeVarianceRows] =
		await Promise.all([
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

// ============================================================================
// PIPELINE (in-progress sales — billed but not yet delivered)
// ============================================================================

export interface PipelineSnapshot {
	openSalesCount: number;
	totalBilled: number;
	totalCollected: number;
	totalPending: number;
	expectedCogs: number;
	expectedGrossProfit: number;
	cogsIncomplete: boolean;
}

/**
 * Snapshot of all PENDING sales — i.e. billed but not yet delivered because
 * the customer has not finished paying. These do **not** count as revenue
 * yet (delivery-based recognition); the panel just shows what's "in the oven".
 *
 * - `totalBilled`: SUM(sales.total) of PENDING sales
 * - `totalCollected`: SUM(sales.paidAmountBcvUsd) — anticipos already received
 * - `totalPending`: totalBilled - totalCollected (amount still owed)
 * - `expectedCogs` / `expectedGrossProfit`: forecast P&L when these sales close
 */
export async function getPipeline(executor: DbOrTx = db): Promise<PipelineSnapshot> {
	const [salesRow, cogsRow, incompleteCogsRow] = await Promise.all([
		executor
			.select({
				billed: sum(sales.total),
				collected: sum(sales.paidAmountBcvUsd),
				cnt: count()
			})
			.from(sales)
			.where(and(isNull(sales.deletedAt), sql`${sales.status} = 'PENDING'`))
			.then(([r]) => ({
				billed: Number(r.billed ?? 0),
				collected: Number(r.collected ?? 0),
				cnt: Number(r.cnt ?? 0)
			})),

		executor
			.select({ total: sum(saleItems.snapshotCostTotal) })
			.from(saleItems)
			.innerJoin(sales, eq(saleItems.saleId, sales.id))
			.where(
				and(
					isNull(sales.deletedAt),
					isNull(saleItems.deletedAt),
					sql`${sales.status} = 'PENDING'`,
					isNotNull(saleItems.snapshotCostTotal)
				)
			)
			.then(([r]) => Number(r.total ?? 0)),

		executor
			.select({ cnt: count() })
			.from(saleItems)
			.innerJoin(sales, eq(saleItems.saleId, sales.id))
			.where(
				and(
					isNull(sales.deletedAt),
					isNull(saleItems.deletedAt),
					sql`${sales.status} = 'PENDING'`,
					isNull(saleItems.snapshotCostTotal)
				)
			)
			.then(([r]) => Number(r.cnt ?? 0))
	]);

	return {
		openSalesCount: salesRow.cnt,
		totalBilled: salesRow.billed,
		totalCollected: salesRow.collected,
		totalPending: salesRow.billed - salesRow.collected,
		expectedCogs: cogsRow,
		expectedGrossProfit: salesRow.billed - cogsRow,
		cogsIncomplete: incompleteCogsRow > 0
	};
}

// Re-export helper for tests
export { asc };
