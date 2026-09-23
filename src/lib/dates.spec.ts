import { describe, it, expect } from 'vitest';
import { composeBusinessTimestamp, calculateAge } from './dates';

describe('composeBusinessTimestamp', () => {
	it('combines form day with submit time in Caracas (UTC-4)', () => {
		// 18:30 UTC = 14:30 VET
		const at = new Date('2026-08-18T18:30:00.000Z');
		expect(composeBusinessTimestamp('2026-08-18', at)).toBe('2026-08-18T18:30:00.000Z');
	});

	it('keeps the VET calendar day on late-night submit (03:30 UTC = 23:30 VET)', () => {
		const at = new Date('2026-08-19T03:30:00.000Z');
		expect(composeBusinessTimestamp('2026-08-18', at)).toBe('2026-08-19T03:30:00.000Z');
	});

	it('accepts a full ISO string as day input (only YYYY-MM-DD is used)', () => {
		const at = new Date('2026-08-18T18:30:00.000Z');
		expect(composeBusinessTimestamp('2026-08-20T04:00:00.000Z', at)).toBe(
			'2026-08-20T18:30:00.000Z'
		);
	});

	it('backdated form day keeps submit wall-clock time', () => {
		const at = new Date('2026-09-11T15:00:00.000Z');
		expect(composeBusinessTimestamp('2026-01-15', at)).toBe('2026-01-15T15:00:00.000Z');
	});
});

describe('calculateAge', () => {
	const pad = (n: number) => String(n).padStart(2, '0');

	it('returns null for missing input', () => {
		expect(calculateAge(null)).toBeNull();
		expect(calculateAge(undefined)).toBeNull();
		expect(calculateAge('')).toBeNull();
	});

	it('counts full years when the birthday already passed', () => {
		const today = new Date();
		const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
		const iso = `${yesterday.getFullYear() - 30}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
		expect(calculateAge(iso)).toBe(30);
	});

	it('does not count the year when the birthday is still ahead', () => {
		const today = new Date();
		const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
		const iso = `${tomorrow.getFullYear() - 30}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}`;
		expect(calculateAge(iso)).toBe(29);
	});

	it('counts the birthday on the exact day', () => {
		const today = new Date();
		const iso = `${today.getFullYear() - 26}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
		expect(calculateAge(iso)).toBe(26);
	});
});
