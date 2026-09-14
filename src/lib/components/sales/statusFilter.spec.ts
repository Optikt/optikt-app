import { describe, expect, it } from 'vitest';
import { SaleStatus } from '$lib/shared/enums';
import { parseSaleStatuses, serializeSaleStatuses } from './statusFilter';

describe('parseSaleStatuses', () => {
	it('returns empty array for null or empty input', () => {
		expect(parseSaleStatuses(null)).toEqual([]);
		expect(parseSaleStatuses('')).toEqual([]);
	});

	it('parses comma-separated statuses', () => {
		expect(parseSaleStatuses('PENDING,READY')).toEqual([SaleStatus.PENDING, SaleStatus.READY]);
	});

	it('ignores invalid values', () => {
		expect(parseSaleStatuses('PENDING,BOGUS,READY')).toEqual([
			SaleStatus.PENDING,
			SaleStatus.READY
		]);
		expect(parseSaleStatuses('BOGUS')).toEqual([]);
	});
});

describe('serializeSaleStatuses', () => {
	it('joins statuses and clears on empty', () => {
		expect(serializeSaleStatuses([SaleStatus.PENDING, SaleStatus.READY])).toBe('PENDING,READY');
		expect(serializeSaleStatuses([])).toBeNull();
	});

	it('round-trips through parse', () => {
		const statuses = [SaleStatus.IN_PROGRESS, SaleStatus.CANCELLED];
		expect(parseSaleStatuses(serializeSaleStatuses(statuses))).toEqual(statuses);
	});
});
