import { describe, expect, it } from 'vitest';
import type { RemoteFormIssue } from '@sveltejs/kit';

import { getFormErrorMessage, issuePathToFieldNames } from './form';

describe('getFormErrorMessage', () => {
	it('returns null for null input', () => {
		expect(getFormErrorMessage(null)).toBeNull();
	});

	it('returns null for undefined input', () => {
		expect(getFormErrorMessage(undefined)).toBeNull();
	});

	it('returns null for empty array', () => {
		expect(getFormErrorMessage([])).toBeNull();
	});

	it('returns string as-is', () => {
		expect(getFormErrorMessage('Error message')).toBe('Error message');
	});

	it('returns first issue message from RemoteFormIssue array', () => {
		const issues: RemoteFormIssue[] = [
			{ message: 'First error', path: ['field1'] },
			{ message: 'Second error', path: ['field2'] }
		];
		expect(getFormErrorMessage(issues)).toBe('First error');
	});

	it('handles single issue in array', () => {
		const issues: RemoteFormIssue[] = [{ message: 'Only error', path: ['field'] }];
		expect(getFormErrorMessage(issues)).toBe('Only error');
	});

	it('normalizes nested issue paths to field names', () => {
		expect(issuePathToFieldNames(['prescription', 'odSphere'])).toEqual([
			'prescription.odSphere'
		]);
		expect(issuePathToFieldNames(['ranges', 0, 'min'])).toEqual([
			'ranges.0.min',
			'ranges[0].min'
		]);
	});

	// Note: scrollToFirstError cannot be easily unit tested as it interacts with DOM
	// It would be better tested in a component/E2E test
});
