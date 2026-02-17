/**
 * Shared formatting utilities
 * Single source of truth for price, currency, and date formatting across the app
 */

import type { Customer } from '$lib/server/db/schema';
import { LENS_TYPE_LABELS, LensType } from '$lib/shared/enums';

/**
 * Format a number as USD currency (es-VE locale)
 * Example: formatPrice(1234.5) → "$1.234,50"
 */
export function formatPrice(price: number): string {
	return new Intl.NumberFormat('es-VE', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2
	}).format(price);
}

/**
 * Format a number as decimal with 2 fraction digits (es-VE locale)
 * Example: formatCurrency(1234.5) → "1.234,50"
 */
export function formatCurrency(value: number): string {
	return new Intl.NumberFormat('es-VE', {
		style: 'decimal',
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	}).format(value);
}

/**
 * Format a date for display (es-VE locale, long month)
 * Example: formatDate(new Date()) → "12 de febrero de 2026"
 */
export function formatDate(
	date: Date | string | null,
	opt: Intl.DateTimeFormatOptions = {}
): string {
	if (!date) return '—';

	const { year = 'numeric', month = 'long', day = 'numeric', ...rest } = opt;

	const d = typeof date === 'string' ? new Date(date) : date;
	return new Intl.DateTimeFormat('es-VE', {
		year,
		month,
		day,
		...rest
	}).format(d);
}

export function getFullName(c: Customer): string {
	return `${c.firstName} ${c.lastName}`;
}

// Format optical value for display
export function formatOpticalValue(value: number | null | undefined): string {
	if (value === null || value === undefined) return '—';
	const sign = value >= 0 ? '+' : '';
	return `${sign}${value.toFixed(2)}`;
}

// Format lens type
export function formatLensType(type: string | null | undefined): string {
	if (!type) return '—';
	return LENS_TYPE_LABELS[type as LensType] ?? type;
}