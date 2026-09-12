import { describe, expect, it } from 'vitest';
import type { InventoryCountSessionSummary } from '$lib/server/db/queries/inventoryCount';
import {
	COUNT_SCOPE_OPTIONS,
	getCoveragePercent,
	getScopeLabel,
	isWithinLastDays,
	mergeCreatedSession
} from './countList';

function session(overrides: Partial<InventoryCountSessionSummary> = {}) {
	return {
		id: 1,
		totalLines: 4,
		countedLines: 3,
		...overrides
	} as InventoryCountSessionSummary;
}

describe('isWithinLastDays', () => {
	it('detects recent and old timestamps', () => {
		expect(isWithinLastDays(new Date().toISOString(), 14)).toBe(true);
		expect(isWithinLastDays('2020-01-01T00:00:00.000Z', 14)).toBe(false);
		expect(isWithinLastDays(null, 14)).toBe(false);
		expect(isWithinLastDays('not-a-date', 14)).toBe(false);
	});
});

describe('getCoveragePercent', () => {
	it('computes rounded coverage', () => {
		expect(getCoveragePercent(session())).toBe(75);
		expect(getCoveragePercent(session({ totalLines: 0, countedLines: 0 }))).toBe(0);
	});
});

describe('getScopeLabel', () => {
	it('resolves known scopes and falls back', () => {
		expect(getScopeLabel('ALL')).toBe('Todo el inventario');
		expect(getScopeLabel('LENS')).toBe('Solo lentes STOCK');
		expect(COUNT_SCOPE_OPTIONS.length).toBe(3);
	});
});

describe('mergeCreatedSession', () => {
	it('prepends created and dedupes by id', () => {
		const created = session({ id: 9 });
		const result = mergeCreatedSession([session({ id: 1 }), session({ id: 9 })], created);

		expect(result.map((s) => s.id)).toEqual([9, 1]);
	});
});
