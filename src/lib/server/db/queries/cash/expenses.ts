/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: expense CRUD.
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
import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { db } from '../../index';
import { cashExpenses, users, type CashExpense, type NewCashExpense } from '../../schema';
import type { DbOrTx } from '../../types';
import { nowISO } from '$lib/dates';
import { type ExpenseCategory } from '$lib/shared/enums';

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
