/**
 * Shared formatting utilities
 * Single source of truth for price, currency, and date formatting across the app
 */

import type { Customer, Prescription } from '$lib/server/db/schema';
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
 *
 * Handles date-only values by using UTC components to avoid timezone shifts
 * that would show the wrong day. Birth dates are stored as date-only (no time),
 * so we extract UTC components to display the correct calendar date.
 */
export function formatDate(
	date: Date | string | null,
	opt: Intl.DateTimeFormatOptions = {}
): string {
	if (!date) return '—';

	const { year = 'numeric', month = 'long', day = 'numeric', ...rest } = opt;

	let d: Date;
	if (typeof date === 'string') {
		// Check if it's a date-only string (YYYY-MM-DD)
		if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			// Parse as local date to avoid timezone shifts
			const [y, m, day] = date.split('-').map(Number);
			d = new Date(y, m - 1, day);
		} else {
			d = new Date(date);
		}
	} else {
		// For Date objects representing date-only values (like birth dates),
		// extract UTC components and create a local date to prevent timezone shift
		// e.g., 1975-08-01T00:00:00.000Z should display as Aug 1, not July 31
		d = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
	}

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

/**
 * Format axis (integer)
 */
export function formatAxis(value: number | null | undefined): string {
	if (value === null || value === undefined) return '—';
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
	return '—';
}

/**
 * Format treatments for display
 */
export function formatTreatments(treatments: Prescription['treatments']): string {
	if (!treatments) return '—';
	const parts: string[] = [];
	if (treatments.antiReflective) parts.push('Antireflejo');
	if (treatments.blueBlock) parts.push('Blueblock');
	if (treatments.photochromic) parts.push('Fotocromático');
	if (treatments.other) parts.push(`Otros: ${treatments.other}`);
	return parts.length > 0 ? parts.join(', ') : '—';
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
