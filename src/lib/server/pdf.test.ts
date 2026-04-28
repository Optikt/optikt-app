import { describe, expect, it } from 'vitest';
import { pickPdfBaseUrl, resolvePdfUrl } from './pdf';

describe('pdf base url helpers', () => {
	it('prefers current request origin over configured env values', () => {
		expect(
			pickPdfBaseUrl(
				'http://localhost:5173',
				'https://origin.optikt.app/',
				'https://public.optikt.app'
			)
		).toBe('http://localhost:5173');
	});

	it('prefers ORIGIN over PUBLIC_BASE_URL', () => {
		expect(pickPdfBaseUrl(undefined, 'https://origin.optikt.app/', 'https://public.optikt.app')).toBe(
			'https://origin.optikt.app'
		);
	});

	it('falls back to PUBLIC_BASE_URL when ORIGIN is missing', () => {
		expect(pickPdfBaseUrl(undefined, undefined, 'https://public.optikt.app/')).toBe(
			'https://public.optikt.app'
		);
	});

	it('uses localhost fallback when no environment base url exists', () => {
		expect(pickPdfBaseUrl()).toBe('http://localhost:5173');
	});

	it('resolves relative urls against the configured base url', () => {
		expect(resolvePdfUrl('/print/sale/123', 'https://origin.optikt.app')).toBe(
			'https://origin.optikt.app/print/sale/123'
		);
	});

	it('keeps absolute urls intact', () => {
		expect(resolvePdfUrl('https://cdn.optikt.app/receipt', 'https://origin.optikt.app')).toBe(
			'https://cdn.optikt.app/receipt'
		);
	});
});