/**
 * Shared formatting utilities
 * Single source of truth for price, currency, and date formatting across the app
 */

import type { Customer, Prescription } from '$lib/server/db/schema';
import { LENS_TYPE_LABELS, LensType } from '$lib/shared/enums';
import { fromISO, fromISODate, toISODate } from '$lib/dates';

// =============================================================================
// DATE-ONLY UTILITIES - re-exported from $lib/dates (canonical source)
// =============================================================================

export { toISODate as dateToISODateString, fromISODate as parseISODateToLocal } from '$lib/dates';

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
 * Example: formatDate("2026-02-12") → "12 de febrero de 2026"
 *
 * Handles date-only strings ("YYYY-MM-DD") by parsing to local midnight
 * to avoid timezone shifts in negative-UTC timezones.
 * Full ISO / timestamptz strings are parsed with `new Date()`.
 */
export function formatDate(
	date: Date | string | null,
	opt: Intl.DateTimeFormatOptions = {}
): string {
	if (!date) return '-';

	let d: Date;
	if (typeof date === 'string') {
		// Date-only strings → parse at local midnight to avoid timezone shifts
		d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? fromISODate(date)! : fromISO(date);
	} else {
		d = date;
	}

	// When dateStyle/timeStyle is used, individual components (year/month/day)
	// must NOT be present - Intl.DateTimeFormat throws otherwise.
	const options: Intl.DateTimeFormatOptions =
		'dateStyle' in opt || 'timeStyle' in opt
			? opt
			: { year: 'numeric', month: 'long', day: 'numeric', ...opt };

	return new Intl.DateTimeFormat('es-VE', options).format(d);
}

/**
 * Format a calendar date stored in a timestamp/string without applying local timezone shifts.
 * Use for domain dates that come from date inputs but are persisted in timestamp columns.
 */
export function formatDateOnly(
	date: Date | string | null,
	opt: Intl.DateTimeFormatOptions = {}
): string {
	if (!date) return '-';

	const datePart = typeof date === 'string' ? date.slice(0, 10) : toISODate(date);
	const d = new Date(`${datePart}T00:00:00.000Z`);
	const options: Intl.DateTimeFormatOptions =
		'dateStyle' in opt || 'timeStyle' in opt
			? { ...opt, timeZone: 'UTC' }
			: { year: 'numeric', month: 'long', day: 'numeric', ...opt, timeZone: 'UTC' };

	return new Intl.DateTimeFormat('es-VE', options).format(d);
}

export function getFullName(c: Customer): string {
	return `${c.firstName} ${c.lastName}`;
}

// Format optical value for display
export function formatOpticalValue(value: number | null | undefined): string {
	if (value === null || value === undefined) return '-';
	const sign = value >= 0 ? '+' : '';
	return `${sign}${value.toFixed(2)}`;
}

// Format lens type
export function formatLensType(type: string | null | undefined): string {
	if (!type) return '-';
	return LENS_TYPE_LABELS[type as LensType] ?? type;
}

/**
 * Format axis (integer)
 */
export function formatAxis(value: number | null | undefined): string {
	if (value === null || value === undefined) return '-';
	return `${value}°`;
}

/**
 * Format DP/NP (Distancia Pupilar / Nasopupilar)
 * DP is total, NP is per-eye measurements
 */
export function formatDpNp(prescription: Prescription): string {
	if (prescription.dp) return `${prescription.dp}mm`;
	if (prescription.npRight && prescription.npLeft) {
		return `${prescription.npRight}/${prescription.npLeft}mm`;
	}
	return '-';
}

/**
 * Format treatments for display
 */
export function formatTreatments(treatments: Prescription['treatments']): string {
	if (!treatments) return '-';
	const parts: string[] = [];
	if (treatments.antiReflective) parts.push('Antireflejo');
	if (treatments.blueBlock) parts.push('Blueblock');
	if (treatments.photochromic) parts.push('Fotocromático');
	if (treatments.other) parts.push(`Otros: ${treatments.other}`);
	return parts.length > 0 ? parts.join(', ') : '-';
}

/**
 * Calculate the profit margin between purchase and sale prices
 * @param purchase - The purchase price
 * @param sale - The sale price
 * @returns The profit margin as a percentage string
 */
export function getProfitMargin(purchase: number, sale: number): string {
	if (purchase === 0) return '0.0%';
	return (((sale - purchase) / purchase) * 100).toFixed(1) + '%';
}

// Format phone for display
export function formatPhone(phone: string | null | undefined): string {
	if (!phone) return '-';
	return phone;
}

/**
 * Get the maximum raw discount value allowed for a given discount type and base amount.
 * For PERCENTAGE, the maximum is always 100.
 * For FIXED, the maximum is the base amount.
 */
export function getDiscountValueMax(type: string, base: number): number {
	const safeBase = Number.isFinite(base) ? Math.max(base, 0) : 0;
	return type === 'PERCENTAGE' ? 100 : safeBase;
}

/**
 * Check whether a raw discount value is valid for the given type and base amount.
 */
export function isDiscountValueValid(value: number, type: string, base: number): boolean {
	return Number.isFinite(value) && value >= 0 && value <= getDiscountValueMax(type, base);
}

/**
 * Clamp a raw discount value to the valid range for the given type and base amount.
 */
export function clampDiscountValue(value: number, type: string, base: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(Math.max(value, 0), getDiscountValueMax(type, base));
}

/**
 * Compute the effective discount amount from a value, type, and base amount.
 * For PERCENTAGE type, calculates (value / 100) * base.
 * For FIXED type, returns the value as-is.
 */
export function computeDiscount(value: number, type: string, base: number): number {
	if (type === 'PERCENTAGE') {
		return (value / 100) * base;
	}
	return value;
}
