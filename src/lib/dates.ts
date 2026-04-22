/**
 * Centralized date utilities - the ONLY file allowed to import date-fns.
 *
 * All date parsing, serialization, and range logic across the app goes
 * through these helpers. Components and server code must never import
 * date-fns directly.
 *
 * Display formatting lives in $lib/utils/format.ts (uses Intl, no date-fns).
 */
import {
	formatDistanceToNow,
	startOfDay,
	endOfDay,
	startOfMonth,
	subDays,
	addDays
} from 'date-fns';
import { es } from 'date-fns/locale';

// ---------------------------------------------------------------------------
// Display helpers (Date → string)
// ---------------------------------------------------------------------------

/**
 * Relative time. Example: "hace 3 horas"
 */
export function toRelative(date: Date): string {
	return formatDistanceToNow(date, { addSuffix: true, locale: es });
}

// ---------------------------------------------------------------------------
// Serialization (Date → ISO string for DB / API)
// ---------------------------------------------------------------------------

/** Serialize a Date to an ISO UTC string (for API / DB writes). */
export function toUTCString(date: Date): string {
	return date.toISOString();
}

/** Current UTC timestamp as an ISO string. Shorthand for DB writes (createdAt, updatedAt…). */
export function nowISO(): string {
	return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

/** Current moment as a Date. Use instead of `new Date()` in app code. */
export function nowUTC(): Date {
	return new Date();
}

/** Parse an ISO string to a Date. Use for values coming from the DB (mode:'string'). */
export function fromISO(iso: string): Date {
	return new Date(iso);
}

/**
 * Parse an ISO date-only string ("YYYY-MM-DD") to a Date at local midnight.
 * Also accepts full ISO timestamps ("YYYY-MM-DDT...") - only the date part is used.
 * Use for date-only values from forms, API, or timestamp columns storing dates.
 */
export function fromISODate(iso: string | null | undefined): Date | undefined {
	if (!iso) return undefined;
	const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
	return new Date(y, m - 1, d);
}

/**
 * Convert a Date to an ISO date-only string ("YYYY-MM-DD") using local components.
 * Use when submitting date-only values to forms/APIs.
 */
export function toISODate(date: Date | null | undefined): string {
	if (!date) return '';
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Server-side range helpers (for DB queries)
// ---------------------------------------------------------------------------

/** Start of today (local midnight). */
export function todayStart(): Date {
	return startOfDay(new Date());
}

/** End of today (23:59:59.999). */
export function todayEnd(): Date {
	return endOfDay(new Date());
}

/** Start of current month (local midnight, first day). */
export function monthStart(): Date {
	return startOfMonth(new Date());
}

/** End of a given date (23:59:59.999). Useful for inclusive date-range queries. */
export function toEndOfDay(date: Date): Date {
	return endOfDay(date);
}

/** Date N days before today. */
export function daysAgo(n: number): Date {
	return subDays(new Date(), n);
}

/** Date N days from today. */
export function daysFromNow(n: number): Date {
	return addDays(new Date(), n);
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

/** Calculate age in full years from a birth-date string. */
export function calculateAge(birthDate: string | null | undefined): number | null {
	if (!birthDate) return null;
	const birth = fromISODate(birthDate);
	if (!birth) return null;
	const today = nowUTC();
	let age = today.getFullYear() - birth.getFullYear();
	const monthDiff = today.getMonth() - birth.getMonth();
	if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
		age--;
	}
	return age;
}
