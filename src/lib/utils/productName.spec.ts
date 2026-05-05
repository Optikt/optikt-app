import { describe, expect, it } from 'vitest';

import { buildProductNameSuggestion } from './productName';

describe('buildProductNameSuggestion', () => {
	it('builds the suggestion from brand and personal code', () => {
		expect(
			buildProductNameSuggestion({
				brandName: 'Ray-Ban',
				supplierName: 'Distribuidora Central',
				personalCode: 'RB-2140'
			})
		).toBe('Ray-Ban RB-2140');
	});

	it('falls back to supplier when there is no brand', () => {
		expect(
			buildProductNameSuggestion({
				supplierName: 'Optica Mayorista',
				personalCode: '82'
			})
		).toBe('Optica Mayorista 82');
	});

	it('returns only the commercial reference while the code is still empty', () => {
		expect(
			buildProductNameSuggestion({
				brandName: 'Oakley',
				personalCode: '   '
			})
		).toBe('Oakley');
	});

	it('collapses repeated spaces from all inputs', () => {
		expect(
			buildProductNameSuggestion({
				brandName: '  Carolina   Herrera  ',
				personalCode: '  CH   5512  '
			})
		).toBe('Carolina Herrera CH 5512');
	});

	it('returns an empty string when there is no brand or supplier', () => {
		expect(
			buildProductNameSuggestion({
				personalCode: 'A-001'
			})
		).toBe('');
	});
});