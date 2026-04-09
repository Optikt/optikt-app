/**
 * Centralized date utilities — the ONLY file allowed to import date-fns / date-fns-tz.
 *
 * All date display and serialization across the app goes through these helpers.
 * Components and server code must never import date-fns directly.
 */
import { formatInTimeZone } from 'date-fns-tz';
import { formatDistanceToNow, startOfDay, endOfDay, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

// ---------------------------------------------------------------------------
// Timezone
// ---------------------------------------------------------------------------

/** Browser timezone (client-side only). */
const getUserTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

// ---------------------------------------------------------------------------
// Display helpers (Date → string)
// ---------------------------------------------------------------------------

/**
 * Format a Date in the user's local timezone including date and time.
 * Example: "08/04/2026 15:30"
 */
export function toLocalDisplay(date: Date): string {
	return formatInTimeZone(date, getUserTz(), 'dd/MM/yyyy HH:mm', { locale: es });
}

/**
 * Format only the date portion in the user's local timezone.
 * Example: "08/04/2026"
 */
export function toLocalDate(date: Date): string {
	return formatInTimeZone(date, getUserTz(), 'dd/MM/yyyy', { locale: es });
}

/**
 * Format a date with configurable style using Intl (es-VE locale, UTC-safe for date-only values).
 *
 * When no `timeStyle` is specified, the date is rendered using UTC components
 * so that date-only values (stored as UTC midnight) don't shift to the previous
 * calendar day in negative-UTC timezones.
 *
 * @example
 * formatDate(date)                          // "12 de febrero de 2026"
 * formatDate(date, { month: 'short' })      // "12 feb 2026"
 * formatDate(date, { dateStyle: 'medium', timeStyle: 'short' }) // "8 abr 2026, 3:30 p. m."
 */
export function formatDate(
	date: Date | string | null,
	opt: Intl.DateTimeFormatOptions = {}
): string {
	if (!date) return '—';

	let d: Date;
	if (typeof date === 'string') {
		if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			const [y, m, dy] = date.split('-').map(Number);
			d = new Date(y, m - 1, dy);
		} else {
			d = new Date(date);
		}
	} else {
		d = date;
	}

	const hasTime = 'timeStyle' in opt;
	if (!hasTime && typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
		// Date-only strings: already parsed to local midnight above, nothing extra needed
	}

	const options: Intl.DateTimeFormatOptions =
		'dateStyle' in opt || 'timeStyle' in opt
			? opt
			: { year: 'numeric', month: 'long', day: 'numeric', ...opt };

	return new Intl.DateTimeFormat('es-VE', options).format(d);
}

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
