import { describe, it, expect } from 'vitest';
import {
	QuoteStatus,
	ALL_QUOTE_STATUSES,
	QUOTE_STATUS_LABELS,
	getQuoteStatusLabel,
	getQuoteStatusBadgeColor
} from './quotes';

describe('QuoteStatus enum', () => {
	it('has all expected statuses', () => {
		expect(ALL_QUOTE_STATUSES).toContain(QuoteStatus.DRAFT);
		expect(ALL_QUOTE_STATUSES).toContain(QuoteStatus.CONVERTED);
		expect(ALL_QUOTE_STATUSES).toContain(QuoteStatus.EXPIRED);
		expect(ALL_QUOTE_STATUSES).toContain(QuoteStatus.CANCELLED);
		expect(ALL_QUOTE_STATUSES).toHaveLength(4);
	});
});

describe('getQuoteStatusLabel', () => {
	it('returns Spanish labels for known statuses', () => {
		expect(getQuoteStatusLabel('DRAFT')).toBe('Borrador');
		expect(getQuoteStatusLabel('CONVERTED')).toBe('Convertido');
		expect(getQuoteStatusLabel('EXPIRED')).toBe('Expirado');
		expect(getQuoteStatusLabel('CANCELLED')).toBe('Cancelado');
	});

	it('returns raw value for unknown status', () => {
		expect(getQuoteStatusLabel('UNKNOWN')).toBe('UNKNOWN');
	});

	it('has a label for every status in the enum', () => {
		for (const status of ALL_QUOTE_STATUSES) {
			expect(QUOTE_STATUS_LABELS[status]).toBeDefined();
		}
	});
});

describe('getQuoteStatusBadgeColor', () => {
	it('returns correct badge colors', () => {
		expect(getQuoteStatusBadgeColor('DRAFT')).toBe('yellow');
		expect(getQuoteStatusBadgeColor('CONVERTED')).toBe('blue');
		expect(getQuoteStatusBadgeColor('EXPIRED')).toBe('gray');
		expect(getQuoteStatusBadgeColor('CANCELLED')).toBe('red');
	});

	it('returns yellow (default) for unknown status', () => {
		expect(getQuoteStatusBadgeColor('SOME_INVALID')).toBe('yellow');
	});
});
