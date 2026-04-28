import { describe, expect, it } from 'vitest';
import { normalizePdfUrl } from './pdf';

describe('normalizePdfUrl', () => {
	it('keeps absolute urls intact', () => {
		expect(normalizePdfUrl('https://cdn.optikt.app/receipt?download=1')).toBe(
			'https://cdn.optikt.app/receipt?download=1'
		);
	});

	it('rejects relative urls', () => {
		expect(() => normalizePdfUrl('/print/sale/123')).toThrowError('PDF URL must be absolute');
	});
});
