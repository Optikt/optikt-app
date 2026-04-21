import { describe, it, expect } from 'vitest';
import {
	formatDiopter,
	formatRange,
	formatCylinderRange,
	formatSymmetricSphere,
	collapseRangesForDisplay
} from './opticalRange';

describe('formatDiopter', () => {
	it('prepends + sign for positive numbers', () => {
		expect(formatDiopter(1.5)).toBe('+1.50');
	});

	it('prepends + sign for zero', () => {
		expect(formatDiopter(0)).toBe('+0.00');
	});

	it('keeps - sign for negative numbers', () => {
		expect(formatDiopter(-2.25)).toBe('-2.25');
	});

	it('formats to two decimal places', () => {
		expect(formatDiopter(3)).toBe('+3.00');
	});

	it('rounds to two decimals', () => {
		expect(formatDiopter(1.125)).toBe('+1.13');
	});

	it('handles small negative values', () => {
		expect(formatDiopter(-0.25)).toBe('-0.25');
	});
});

describe('formatRange', () => {
	it('returns em-dash when both min and max are null', () => {
		expect(formatRange(null, null)).toBe('—');
	});

	it('formats full range with both min and max', () => {
		expect(formatRange(-6, 6)).toBe('-6.00 a +6.00');
	});

	it('formats from-only when max is null', () => {
		expect(formatRange(-2, null)).toBe('desde -2.00');
	});

	it('formats to-only when min is null', () => {
		expect(formatRange(null, 4)).toBe('hasta +4.00');
	});

	it('handles zero values', () => {
		expect(formatRange(0, 0)).toBe('+0.00 a +0.00');
	});

	it('handles negative-only range', () => {
		expect(formatRange(-8, -2)).toBe('-8.00 a -2.00');
	});
});

describe('formatCylinderRange', () => {
	it('swaps min and max for cylinder display', () => {
		// cylinder min=-6, max=-0.25 → formatRange(max, min) → "-0.25 a -6.00"
		expect(formatCylinderRange(-6, -0.25)).toBe('-0.25 a -6.00');
	});

	it('returns em-dash when both are null', () => {
		expect(formatCylinderRange(null, null)).toBe('—');
	});

	it('handles only min provided (shows as hasta)', () => {
		// formatRange(null, min) → "hasta formatDiopter(min)"
		expect(formatCylinderRange(-4, null)).toBe('hasta -4.00');
	});

	it('handles only max provided (shows as desde)', () => {
		// formatRange(max, null) → "desde formatDiopter(max)"
		expect(formatCylinderRange(null, -0.25)).toBe('desde -0.25');
	});
});

describe('formatSymmetricSphere', () => {
	it('formats ± notation when absMin is 0', () => {
		expect(formatSymmetricSphere(0, 6)).toBe('±6.00');
	});

	it('formats range ± notation when absMin > 0', () => {
		expect(formatSymmetricSphere(2, 8)).toBe('±2.00 a ±8.00');
	});

	it('handles equal absMin and absMax', () => {
		expect(formatSymmetricSphere(4, 4)).toBe('±4.00 a ±4.00');
	});
});

describe('collapseRangesForDisplay', () => {
	it('returns empty array for empty input', () => {
		expect(collapseRangesForDisplay([])).toEqual([]);
	});

	it('maps a range with all fields populated', () => {
		const ranges = [
			{
				id: 'r1',
				lensCatalogItemId: 'item1',
				sphereMin: -6,
				sphereMax: 6,
				cylinderMin: -4,
				cylinderMax: -0.25,
				additionMin: 0.75,
				additionMax: 3.5,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			}
		];

		const result = collapseRangesForDisplay(ranges);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('r1');
		expect(result[0].symmetric).toBe(false);
		expect(result[0].sphereLabel).toBe('-6.00 a +6.00');
		expect(result[0].cylinderLabel).toBe('-0.25 a -4.00');
		expect(result[0].additionLabel).toBe('+0.75 a +3.50');
	});

	it('returns null for cylinder and addition when not provided', () => {
		const ranges = [
			{
				id: 'r2',
				lensCatalogItemId: 'item2',
				sphereMin: -2,
				sphereMax: 2,
				cylinderMin: null,
				cylinderMax: null,
				additionMin: null,
				additionMax: null,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			}
		];

		const result = collapseRangesForDisplay(ranges);

		expect(result[0].cylinderLabel).toBeNull();
		expect(result[0].additionLabel).toBeNull();
	});

	it('handles partially defined cylinder (only min)', () => {
		const ranges = [
			{
				id: 'r3',
				lensCatalogItemId: 'item3',
				sphereMin: 0,
				sphereMax: 4,
				cylinderMin: -2,
				cylinderMax: null,
				additionMin: null,
				additionMax: null,
				createdAt: '2024-01-01T00:00:00Z',
				updatedAt: '2024-01-01T00:00:00Z'
			}
		];

		const result = collapseRangesForDisplay(ranges);

		expect(result[0].cylinderLabel).toBe('hasta -2.00');
	});

	it('handles multiple ranges', () => {
		const ranges = [
			{
				id: 'a',
				lensCatalogItemId: 'x',
				sphereMin: -1,
				sphereMax: 1,
				cylinderMin: null,
				cylinderMax: null,
				additionMin: null,
				additionMax: null,
				createdAt: '',
				updatedAt: ''
			},
			{
				id: 'b',
				lensCatalogItemId: 'x',
				sphereMin: -4,
				sphereMax: 4,
				cylinderMin: null,
				cylinderMax: null,
				additionMin: null,
				additionMax: null,
				createdAt: '',
				updatedAt: ''
			}
		];

		const result = collapseRangesForDisplay(ranges);

		expect(result).toHaveLength(2);
		expect(result[0].id).toBe('a');
		expect(result[1].id).toBe('b');
	});
});
