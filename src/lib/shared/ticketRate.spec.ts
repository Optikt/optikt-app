import { describe, it, expect } from 'vitest';
import { resolveTicketRate } from './ticketRate';

describe('resolveTicketRate', () => {
	it('prefers the frozen snapshot over the live rate', () => {
		expect(resolveTicketRate(100, 200)).toBe(100);
	});

	it('falls back to live when snapshot is null (pre-feature sale)', () => {
		expect(resolveTicketRate(null, 200)).toBe(200);
	});

	it('falls back to live when snapshot is zero or negative', () => {
		expect(resolveTicketRate(0, 200)).toBe(200);
		expect(resolveTicketRate(-5, 200)).toBe(200);
	});

	it('returns null when neither rate is usable', () => {
		expect(resolveTicketRate(null, null)).toBeNull();
		expect(resolveTicketRate(null, 0)).toBeNull();
		expect(resolveTicketRate(undefined, undefined)).toBeNull();
	});
});
