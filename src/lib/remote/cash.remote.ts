/**
 * Cash & Expenses Remote Functions
 * Server-side queries + commands for the Caja module.
 */
import { error } from '@sveltejs/kit';
import { query, command } from '$app/server';
import { requireAdmin } from '$lib/server/guards';
import { db } from '$lib/server/db';
import {
	createExpense,
	findExpenseById,
	getCashReport,
	getDailyBreakdown,
	getPipeline,
	listExpenses,
	voidExpense,
	type CashReport,
	type DailyBreakdownRow,
	type ExpenseListRow,
	type PipelineSnapshot
} from '$lib/server/db/queries/cash';
import { auditService, getAuditContext } from '$lib/server/audit';
import {
	CashReportFiltersSchema,
	CreateExpenseSchema,
	ListExpensesFiltersSchema,
	VoidExpenseSchema
} from '$lib/schemas/cash';
import type { CashExpense } from '$lib/server/db/schema';
import { isUsdLike } from '$lib/shared/enums';
import { fromISODate, toEndOfDay, toUTCString } from '$lib/dates';

// ============================================================================
// HELPERS
// ============================================================================

/** Convert YYYY-MM-DD range to a timestamp-with-tz interval covering full days. */
function toRange(from: string, to: string): { fromTs: string; toTs: string } {
	return {
		fromTs: toUTCString(fromISODate(from)!),
		toTs: toUTCString(toEndOfDay(fromISODate(to)!))
	};
}

/**
 * Server-side recomputation of `amountUsd` from amount + exchangeRate.
 * Mirrors the client logic but is the source of truth — never trust the
 * client to report the conversion correctly.
 */
function computeAmountUsd(args: {
	currency: 'USD' | 'VES' | 'USDT' | 'EUR';
	amount: number;
	exchangeRate?: number;
}): number {
	const { currency, amount, exchangeRate } = args;
	if (isUsdLike(currency)) return amount;
	if (currency === 'VES') {
		if (!exchangeRate || exchangeRate <= 0) {
			error(400, 'Tasa requerida para egresos en Bs');
		}
		// Bs / (Bs per USD) = USD
		return amount / exchangeRate;
	}
	if (currency === 'EUR') {
		if (!exchangeRate || exchangeRate <= 0) {
			error(400, 'Tasa requerida para egresos en EUR');
		}
		// Treat exchangeRate as EUR→USD multiplier
		return amount * exchangeRate;
	}
	return amount;
}

// ============================================================================
// QUERIES (ADMIN + MANAGER)
// ============================================================================

export const getCashReportQuery = query(
	CashReportFiltersSchema,
	async (data): Promise<CashReport> => {
		requireAdmin();
		const { fromTs, toTs } = toRange(data.from, data.to);
		return getCashReport({ from: fromTs, to: toTs });
	}
);

export const getDailyBreakdownQuery = query(
	CashReportFiltersSchema,
	async (data): Promise<DailyBreakdownRow[]> => {
		requireAdmin();
		const { fromTs, toTs } = toRange(data.from, data.to);
		return getDailyBreakdown({ from: fromTs, to: toTs });
	}
);

export const listExpensesQuery = query(
	ListExpensesFiltersSchema,
	async (data): Promise<ExpenseListRow[]> => {
		requireAdmin();
		const { fromTs, toTs } = toRange(data.from, data.to);
		return listExpenses({
			from: fromTs,
			to: toTs,
			category: data.category,
			includeVoided: data.includeVoided
		});
	}
);

export const getPipelineQuery = query(async (): Promise<PipelineSnapshot> => {
	requireAdmin();
	return getPipeline();
});

// ============================================================================
// COMMANDS (ADMIN + MANAGER)
// ============================================================================

export const createExpenseCommand = command(
	CreateExpenseSchema,
	async (data): Promise<CashExpense> => {
		const user = requireAdmin();
		const context = getAuditContext();

		const amountUsd = computeAmountUsd({
			currency: data.currency,
			amount: data.amount,
			exchangeRate: data.exchangeRate
		});

		const expense = await db.transaction(async (tx) => {
			return createExpense(
				{
					category: data.category,
					description: data.description,
					currency: data.currency,
					amount: data.amount,
					amountUsd,
					exchangeRate: data.exchangeRate ?? null,
					bcvRate: data.bcvRate ?? null,
					rateType: data.rateType ?? null,
					expenseDate: data.expenseDate,
					registeredById: user.id,
					reference: data.reference ?? null,
					notes: data.notes ?? null
				},
				tx
			);
		});

		await auditService.logCreate('cash_expense', expense, context, {
			excludeFields: ['createdAt', 'updatedAt']
		});

		return expense;
	}
);

export const voidExpenseCommand = command(VoidExpenseSchema, async (data): Promise<CashExpense> => {
	const user = requireAdmin();
	const context = getAuditContext();

	const existing = await findExpenseById(data.id);
	if (!existing) error(404, 'Egreso no encontrado');
	if (existing.voidedAt) error(409, 'Egreso ya estaba anulado');

	const updated = await db.transaction(async (tx) => {
		const row = await voidExpense(data.id, user.id, data.voidReason, tx);
		if (!row) error(409, 'Egreso ya estaba anulado');
		return row;
	});

	await auditService.logUpdate('cash_expense', data.id, existing, updated, context, {
		excludeFields: ['createdAt', 'updatedAt']
	});

	return updated;
});
