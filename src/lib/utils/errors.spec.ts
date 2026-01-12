import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './errors';
import { error as svelteKitError } from '@sveltejs/kit';

describe('getErrorMessage', () => {
	it('extracts message from standard Error', () => {
		const err = new Error('Something went wrong');
		expect(getErrorMessage(err)).toBe('Something went wrong');
	});

	it('extracts message from SvelteKit HTTP error', () => {
		// SvelteKit's error() throws an HttpError with body.message
		try {
			throw svelteKitError(400, 'Bad request');
		} catch (e) {
			expect(getErrorMessage(e)).toBe('Bad request');
		}
	});

	it('returns fallback for unknown error types', () => {
		expect(getErrorMessage('string error')).toBe('Ha ocurrido un error');
		expect(getErrorMessage(123)).toBe('Ha ocurrido un error');
		expect(getErrorMessage(null)).toBe('Ha ocurrido un error');
		expect(getErrorMessage(undefined)).toBe('Ha ocurrido un error');
		expect(getErrorMessage({})).toBe('Ha ocurrido un error');
	});

	it('uses custom fallback message', () => {
		expect(getErrorMessage(null, 'Custom error')).toBe('Custom error');
		expect(getErrorMessage({}, 'Oops!')).toBe('Oops!');
	});

	it('prefers Error.message over fallback', () => {
		const err = new Error('Specific error');
		expect(getErrorMessage(err, 'Fallback')).toBe('Specific error');
	});
});
