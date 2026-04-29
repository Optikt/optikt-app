import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPdfShutdownHandler, normalizePdfUrl, registerPdfBrowserShutdown } from './pdf';

type PdfGlobalState = typeof globalThis & {
	__optiktPdfShutdownRegistered?: boolean;
};

const pdfGlobal = globalThis as PdfGlobalState;

beforeEach(() => {
	pdfGlobal.__optiktPdfShutdownRegistered = undefined;
	vi.restoreAllMocks();
});

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

describe('createPdfShutdownHandler', () => {
	it('calls the injected close function', async () => {
		const closeBrowser = vi.fn().mockResolvedValue(undefined);
		const logError = vi.fn();
		const shutdown = createPdfShutdownHandler(closeBrowser, logError);

		await expect(shutdown()).resolves.toBeUndefined();

		expect(closeBrowser).toHaveBeenCalledTimes(1);
		expect(logError).not.toHaveBeenCalled();
	});

	it('logs and swallows shutdown errors', async () => {
		const failure = new Error('boom');
		const closeBrowser = vi.fn().mockRejectedValue(failure);
		const logError = vi.fn();
		const shutdown = createPdfShutdownHandler(closeBrowser, logError);

		await expect(shutdown()).resolves.toBeUndefined();

		expect(closeBrowser).toHaveBeenCalledTimes(1);
		expect(logError).toHaveBeenCalledTimes(1);
		expect(logError).toHaveBeenCalledWith('[pdf] failed to close browser during shutdown', failure);
	});
});

describe('registerPdfBrowserShutdown', () => {
	it('registers SIGINT and SIGTERM once', () => {
		const processOnSpy = vi.spyOn(process, 'on').mockReturnValue(process);

		registerPdfBrowserShutdown();

		expect(processOnSpy).toHaveBeenCalledTimes(2);
		expect(processOnSpy).toHaveBeenNthCalledWith(1, 'SIGINT', expect.any(Function));
		expect(processOnSpy).toHaveBeenNthCalledWith(2, 'SIGTERM', expect.any(Function));
	});

	it('does not register duplicate handlers', () => {
		const processOnSpy = vi.spyOn(process, 'on').mockReturnValue(process);

		registerPdfBrowserShutdown();
		registerPdfBrowserShutdown();

		expect(processOnSpy).toHaveBeenCalledTimes(2);
	});
});
