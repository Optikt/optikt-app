import { EXPENSE_CATEGORY_LABELS } from '$lib/shared/enums';
import type { ExpenseCategory, ExpenseCurrency, RateType } from '$lib/shared/enums';
import type { ExpenseListRow } from '$lib/server/db/queries/cash';
import { formatDateOnly } from '$lib/utils';

export interface ExpenseFormData {
	category: ExpenseCategory;
	description: string;
	currency: ExpenseCurrency;
	amount: string;
	bcvRate: string;
	exchangeRate: string;
	rateType: RateType;
	expenseDate: string;
	reference: string;
	notes: string;
}

export function emptyExpenseForm(): ExpenseFormData {
	const today = new Date().toISOString().slice(0, 10);
	return {
		category: 'OTHER',
		description: '',
		currency: 'USD',
		amount: '',
		bcvRate: '',
		exchangeRate: '',
		rateType: 'BCV',
		expenseDate: today,
		reference: '',
		notes: ''
	};
}

export function validateVoidReason(reason: string | null): string | null {
	if (!reason) return null;
	if (reason.trim().length < 5) return 'Motivo mínimo 5 caracteres';
	return null;
}

export function buildExpenseCsvRows(expenses: ExpenseListRow[]): string[][] {
	return expenses.map((e) => [
		formatDateOnly(e.expenseDate, { dateStyle: 'short' }),
		EXPENSE_CATEGORY_LABELS[e.category],
		e.description,
		e.currency,
		e.amount.toFixed(2),
		e.amountUsd.toFixed(2),
		e.exchangeRate?.toFixed(4) ?? '',
		e.bcvRate?.toFixed(4) ?? '',
		e.registeredByName ?? '',
		e.reference ?? '',
		e.voidedAt ? 'ANULADO' : 'Activo'
	]);
}

export const EXPENSE_CSV_HEADERS = [
	'Fecha',
	'Categoría',
	'Descripción',
	'Moneda',
	'Monto',
	'Equivalente USD BCV',
	'Tasa operativa',
	'Tasa BCV',
	'Registrado por',
	'Referencia',
	'Estado'
];
