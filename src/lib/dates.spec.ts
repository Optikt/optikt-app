import { describe, it, expect } from 'vitest';
import { composeBusinessTimestamp } from './dates';

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
