/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: P&L report.
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
import { and, desc, eq, gte, isNull, isNotNull, lte, sql, sum, count } from 'drizzle-orm';
import { db } from '../../index';
import {
	cashExpenses,
	purchaseOrderEarlyPaymentBenefits,
	purchaseOrderPayments,
	purchaseOrders,
	sales,
	saleItems,
	salePayments
} from '../../schema';
import type { DbOrTx } from '../../types';

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

export async function getPurchaseDiscountEarnedRows(
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

export async function getExchangeVarianceRows(
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
