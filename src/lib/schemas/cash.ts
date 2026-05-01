/**
 * Cash & Expenses validation schemas
 */
import { z } from 'zod';
import { CoercedNumber, EntityIdSchema } from './common';
import { ALL_EXPENSE_CATEGORIES, ALL_EXPENSE_CURRENCIES, ALL_RATE_TYPES } from '$lib/shared/enums';

export const ExpenseCategoryEnum = z.enum(ALL_EXPENSE_CATEGORIES);
export const ExpenseCurrencyEnum = z.enum(ALL_EXPENSE_CURRENCIES);
export const RateTypeEnum = z.enum(ALL_RATE_TYPES);

// ============================================================================
// CREATE EXPENSE
// ============================================================================

/**
 * Payload from the new-expense form. The server recomputes `amountUsd`
 * from `amount`/`exchangeRate` so the client cannot misreport totals.
 */
export const CreateExpenseSchema = z
	.object({
		category: ExpenseCategoryEnum,
		description: z
			.string()
			.trim()
			.min(3, 'Descripción mínima 3 caracteres')
			.max(500, 'Descripción muy larga'),
		currency: ExpenseCurrencyEnum,
		amount: CoercedNumber.positive('Monto debe ser mayor a 0'),
		exchangeRate: CoercedNumber.positive('Tasa debe ser mayor a 0').optional(),
		bcvRate: CoercedNumber.positive('Tasa BCV debe ser mayor a 0').optional(),
		rateType: RateTypeEnum.optional(),
		expenseDate: z.iso.datetime('Fecha del gasto requerida'),
		reference: z.string().trim().max(100).optional(),
		notes: z.string().trim().max(1000).optional()
	})
	.superRefine((data, ctx) => {
		// Non-USD currencies must include conversion data.
		const needsRate = data.currency === 'VES' || data.currency === 'EUR';
		if (needsRate) {
			if (data.exchangeRate == null) {
				ctx.addIssue({
					code: 'custom',
					path: ['exchangeRate'],
					message: 'Tasa requerida para esta moneda'
				});
			}
			if (data.rateType == null) {
				ctx.addIssue({
					code: 'custom',
					path: ['rateType'],
					message: 'Tipo de tasa requerido'
				});
			}
		}
	});

export type CreateExpenseInput = z.infer<typeof CreateExpenseSchema>;

// ============================================================================
// VOID EXPENSE
// ============================================================================

export const VoidExpenseSchema = z.object({
	id: z.uuid('ID inválido'),
	voidReason: z.string().trim().min(5, 'Motivo mínimo 5 caracteres').max(500, 'Motivo muy largo')
});

// ============================================================================
// LIST / FILTERS
// ============================================================================

export const ListExpensesFiltersSchema = z.object({
	from: z.iso.date('Fecha desde requerida'),
	to: z.iso.date('Fecha hasta requerida'),
	category: ExpenseCategoryEnum.optional(),
	includeVoided: z.boolean().default(false)
});

export const CashReportFiltersSchema = z
	.object({
		from: z.iso.date('Fecha desde requerida'),
		to: z.iso.date('Fecha hasta requerida')
	})
	.refine((d) => d.to >= d.from, {
		path: ['to'],
		message: 'Fecha hasta debe ser ≥ desde'
	});

export const ExpenseIdSchema = EntityIdSchema('Egreso');
