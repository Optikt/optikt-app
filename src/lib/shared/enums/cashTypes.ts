/**
 * Cash & Expenses Enums
 * Shared between client and server for type safety
 */

// ============================================================================
// EXPENSE CATEGORY
// ============================================================================

export const ALL_EXPENSE_CATEGORIES = [
	'RENT',
	'SALARY',
	'UTILITIES_ELECTRICITY',
	'UTILITIES_WATER',
	'UTILITIES_INTERNET',
	'TAX',
	'SUPPLIES',
	'MAINTENANCE',
	'TRANSPORT',
	'PUBLICITY',
	'BANK_FEE',
	'REFUND',
	'OTHER'
] as const;

export type ExpenseCategory = (typeof ALL_EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
	RENT: 'Alquiler',
	SALARY: 'Sueldos',
	UTILITIES_ELECTRICITY: 'Electricidad',
	UTILITIES_WATER: 'Agua',
	UTILITIES_INTERNET: 'Internet',
	TAX: 'Impuestos',
	SUPPLIES: 'Insumos',
	MAINTENANCE: 'Mantenimiento',
	TRANSPORT: 'Transporte',
	PUBLICITY: 'Publicidad',
	BANK_FEE: 'Comisión bancaria',
	REFUND: 'Reembolso a cliente',
	OTHER: 'Otro'
};

export function getExpenseCategoryLabel(category: string): string {
	return EXPENSE_CATEGORY_LABELS[category as ExpenseCategory] ?? category;
}

// ============================================================================
// EXPENSE CURRENCY
// ============================================================================

export const ALL_EXPENSE_CURRENCIES = ['USD', 'VES', 'USDT', 'EUR'] as const;

export type ExpenseCurrency = (typeof ALL_EXPENSE_CURRENCIES)[number];

export const EXPENSE_CURRENCY_LABELS: Record<ExpenseCurrency, string> = {
	USD: 'USD',
	VES: 'Bs',
	USDT: 'USDT',
	EUR: 'EUR'
};

export const EXPENSE_CURRENCY_SYMBOLS: Record<ExpenseCurrency, string> = {
	USD: '$',
	VES: 'Bs.',
	USDT: '$',
	EUR: '€'
};

/** Whether the currency is already normalized to USD BCV without extra conversion. */
export function isUsdLike(currency: ExpenseCurrency): boolean {
	return currency === 'USD';
}

// ============================================================================
// RATE TYPE
// ============================================================================

export const ALL_RATE_TYPES = ['BCV', 'PARALLEL', 'DIRECT'] as const;

export type RateType = (typeof ALL_RATE_TYPES)[number];

export const RATE_TYPE_LABELS: Record<RateType, string> = {
	BCV: 'BCV',
	PARALLEL: 'Paralela',
	DIRECT: 'Directa'
};
