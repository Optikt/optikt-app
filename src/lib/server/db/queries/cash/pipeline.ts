/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: pipeline snapshot.
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
import { and, asc, eq, isNull, isNotNull, sql, sum, count } from 'drizzle-orm';
import { db } from '../../index';
import { sales, saleItems } from '../../schema';
import type { DbOrTx } from '../../types';

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
