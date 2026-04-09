import { describe, it, expect } from 'vitest';
import { dateFromUTC, dateToISODateString, parseISODateToLocal, formatDate } from './format';

describe('dateFromUTC', () => {
	it('returns undefined for null input', () => {
		expect(dateFromUTC(null)).toBeUndefined();
	});

	it('returns undefined for undefined input', () => {
		expect(dateFromUTC(undefined)).toBeUndefined();
	});

	it('converts UTC midnight to local midnight preserving the calendar date', () => {
		// Create a date at UTC midnight on March 9, 2000
		// In UTC: 2000-03-09T00:00:00.000Z
		const utcMidnight = new Date(Date.UTC(2000, 2, 9, 0, 0, 0, 0));

		// The function should return a Date at local midnight on March 9
		const result = dateFromUTC(utcMidnight);

		expect(result).toBeInstanceOf(Date);
		// The local date components should be March 9, 2000
		expect(result!.getFullYear()).toBe(2000);
		expect(result!.getMonth()).toBe(2); // March (0-indexed)
		expect(result!.getDate()).toBe(9);
		// The time should be midnight in local time (hours, minutes, seconds all 0)
		expect(result!.getHours()).toBe(0);
		expect(result!.getMinutes()).toBe(0);
		expect(result!.getSeconds()).toBe(0);
	});

	it('handles dates at the end of the year correctly', () => {
		// December 31, 2023 at UTC midnight
		const utcMidnight = new Date(Date.UTC(2023, 11, 31, 0, 0, 0, 0));
		const result = dateFromUTC(utcMidnight);

		expect(result!.getFullYear()).toBe(2023);
		expect(result!.getMonth()).toBe(11); // December
		expect(result!.getDate()).toBe(31);
	});

	it('handles dates at the beginning of the year correctly', () => {
		// January 1, 2024 at UTC midnight
		const utcMidnight = new Date(Date.UTC(2024, 0, 1, 0, 0, 0, 0));
		const result = dateFromUTC(utcMidnight);

		expect(result!.getFullYear()).toBe(2024);
		expect(result!.getMonth()).toBe(0); // January
		expect(result!.getDate()).toBe(1);
	});
});

describe('dateToISODateString', () => {
	it('returns empty string for null input', () => {
		expect(dateToISODateString(null)).toBe('');
	});

	it('returns empty string for undefined input', () => {
		expect(dateToISODateString(undefined)).toBe('');
	});

	it('formats a date to ISO date string using local components', () => {
		// Create a date at local midnight on March 9, 2000
		const localDate = new Date(2000, 2, 9); // March 9, 2000 local midnight

		const result = dateToISODateString(localDate);

		expect(result).toBe('2000-03-09');
	});

	it('pads single-digit months with zero', () => {
		// January 5, 2000
		const localDate = new Date(2000, 0, 5);

		const result = dateToISODateString(localDate);

		expect(result).toBe('2000-01-05');
	});

	it('handles December correctly', () => {
		// December 31, 2023
		const localDate = new Date(2023, 11, 31);

		const result = dateToISODateString(localDate);

		expect(result).toBe('2023-12-31');
	});
});

describe('parseISODateToLocal', () => {
	it('returns undefined for null input', () => {
		expect(parseISODateToLocal(null)).toBeUndefined();
	});

	it('returns undefined for undefined input', () => {
		expect(parseISODateToLocal(undefined)).toBeUndefined();
	});

	it('returns undefined for empty string', () => {
		expect(parseISODateToLocal('')).toBeUndefined();
	});

	it('parses ISO date string to local midnight Date', () => {
		const result = parseISODateToLocal('2000-03-09');

		expect(result).toBeInstanceOf(Date);
		expect(result!.getFullYear()).toBe(2000);
		expect(result!.getMonth()).toBe(2); // March (0-indexed)
		expect(result!.getDate()).toBe(9);
		expect(result!.getHours()).toBe(0);
		expect(result!.getMinutes()).toBe(0);
		expect(result!.getSeconds()).toBe(0);
	});

	it('parses January 1 correctly', () => {
		const result = parseISODateToLocal('2024-01-01');

		expect(result!.getFullYear()).toBe(2024);
		expect(result!.getMonth()).toBe(0); // January
		expect(result!.getDate()).toBe(1);
	});

	it('parses December 31 correctly', () => {
		const result = parseISODateToLocal('2023-12-31');

		expect(result!.getFullYear()).toBe(2023);
		expect(result!.getMonth()).toBe(11); // December
		expect(result!.getDate()).toBe(31);
	});
});

describe('formatDate', () => {
	it('returns em-dash for null input', () => {
		expect(formatDate(null)).toBe('—');
	});

	it('formats a Date object using its local date components', () => {
		// Create a local date (as used by date pickers in the UI)
		const localDate = new Date(2000, 2, 9); // March 9 local

		const result = formatDate(localDate);

		// Should display March 9
		expect(result).toContain('9');
		expect(result).toContain('marzo');
		expect(result).toContain('2000');
	});

	it('formats an ISO date string correctly', () => {
		const result = formatDate('2000-03-09');

		expect(result).toContain('9');
		expect(result).toContain('marzo');
		expect(result).toContain('2000');
	});

	it('formats with custom options', () => {
		const result = formatDate('2000-03-09', { month: 'short' });

		expect(result).toContain('mar');
	});

	it('handles date-only string format (YYYY-MM-DD)', () => {
		const result = formatDate('2024-01-15');

		expect(result).toContain('15');
		expect(result).toContain('enero');
		expect(result).toContain('2024');
	});
});

describe('round-trip conversion', () => {
	it('preserves the calendar date through dateFromUTC -> dateToISODateString', () => {
		// Simulate what comes from the database: UTC midnight on March 9, 2000
		const dbDate = new Date(Date.UTC(2000, 2, 9, 0, 0, 0, 0));

		// Convert to local midnight for UI
		const localDate = dateFromUTC(dbDate);

		// Convert back to ISO string for form submission
		const isoString = dateToISODateString(localDate);

		// Should preserve the original calendar date
		expect(isoString).toBe('2000-03-09');
	});

	it('preserves the calendar date through parseISODateToLocal -> dateToISODateString', () => {
		// User enters March 9, 2000
		const isoString = '2000-03-09';

		// Parse to local Date for UI
		const localDate = parseISODateToLocal(isoString);

		// Convert back to ISO string
		const result = dateToISODateString(localDate);

		// Should preserve the original calendar date
		expect(result).toBe('2000-03-09');
	});
});
