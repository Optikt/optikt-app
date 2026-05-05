import { describe, expect, it } from 'vitest';

import { sortOptionsBySuggested } from './sortOptionsBySuggested';

describe('sortOptionsBySuggested', () => {
	it('moves suggested options to the top while preserving original option order', () => {
		const options = [
			{ id: 'supplier-1', name: 'Proveedor 1' },
			{ id: 'supplier-2', name: 'Proveedor 2' },
			{ id: 'supplier-3', name: 'Proveedor 3' }
		];

		expect(
			sortOptionsBySuggested(options, ['supplier-3', 'supplier-1']).map((option) => option.id)
		).toEqual(['supplier-1', 'supplier-3', 'supplier-2']);
	});

	it('keeps the original order when there are no suggestions', () => {
		const options = [
			{ id: 'brand-1', name: 'Marca 1' },
			{ id: 'brand-2', name: 'Marca 2' }
		];

		expect(sortOptionsBySuggested(options, [])).toEqual(options);
	});

	it('keeps pending options at the end even when suggestions exist', () => {
		const options = [
			{ id: 'brand-1', name: 'Marca 1' },
			{ id: 'brand-2', name: 'Marca 2', isPending: true },
			{ id: 'brand-3', name: 'Marca 3' }
		];

		expect(
			sortOptionsBySuggested(options, ['brand-3', 'brand-2']).map((option) => option.id)
		).toEqual(['brand-3', 'brand-1', 'brand-2']);
	});

	it('ignores suggested ids that are not present in the options', () => {
		const options = [
			{ id: 'brand-1', name: 'Marca 1' },
			{ id: 'brand-2', name: 'Marca 2' }
		];

		expect(sortOptionsBySuggested(options, ['missing-id']).map((option) => option.id)).toEqual([
			'brand-1',
			'brand-2'
		]);
	});
});
