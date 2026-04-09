/**
 * Centralized date utilities — the ONLY file allowed to import date-fns.
 *
 * All date parsing, serialization, and range logic across the app goes
 * through these helpers. Components and server code must never import
 * date-fns directly.
 *
 * Display formatting lives in $lib/utils/format.ts (uses Intl, no date-fns).
 */
import { formatDistanceToNow, startOfDay, endOfDay, startOfMonth } from 'date-fns';
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
 * Use for date-only values from forms or API.
 */
export function fromISODate(iso: string | null | undefined): Date | undefined {
	if (!iso) return undefined;
	const [y, m, d] = iso.split('-').map(Number);
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
