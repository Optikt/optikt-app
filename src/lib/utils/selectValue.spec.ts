import { describe, expect, it } from 'vitest';

import { getSingleSelectValue, normalizeSingleSelectValue } from './selectValue';

describe('selectValue helpers', () => {
	it('keeps a selected value when it still exists in the options', () => {
		expect(
			normalizeSingleSelectValue('supplier-1', [
				{ id: 'supplier-1', name: 'Lab Express' },
				{ id: 'supplier-2', name: 'Novak' }
			])
		).toBe('supplier-1');
	});

	it('clears a selected value when it no longer exists in the options', () => {
		expect(
			normalizeSingleSelectValue('supplier-3', [
				{ id: 'supplier-1', name: 'Lab Express' },
				{ id: 'supplier-2', name: 'Novak' }
			])
		).toBe('');
	});

	it('supports custom value fields', () => {
		expect(
			normalizeSingleSelectValue(
				'material-2',
				[
					{ value: 'material-1', label: 'CR-39' },
					{ value: 'material-2', label: 'Policarbonato' }
				],
				'value'
			)
		).toBe('material-2');
	});

	it('extracts the value from an option object', () => {
		expect(getSingleSelectValue({ id: 'brand-1', name: 'Ray-Ban' })).toBe('brand-1');
	});

	it('extracts the first value from array payloads', () => {
		expect(getSingleSelectValue([{ id: 'lens-1', name: 'Blue Cut' }])).toBe('lens-1');
	});

	it('returns an empty string for nullish payloads', () => {
		expect(getSingleSelectValue(null)).toBe('');
		expect(getSingleSelectValue(undefined)).toBe('');
	});
});
