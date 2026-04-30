import chromium from '@sparticuz/chromium';
import type { Browser } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';

let browserPromise: Promise<Browser> | null = null;

type PdfGlobalState = typeof globalThis & {
	__optiktPdfShutdownRegistered?: boolean;
};

const pdfGlobal = globalThis as PdfGlobalState;
const PDF_SHUTDOWN_ERROR_MESSAGE = '[pdf] failed to close browser during shutdown';

type PdfShutdownLogger = (message: string, error: unknown) => void;
type PdfShutdownFinalize = () => void;

export function normalizePdfUrl(url: string): string {
	try {
		return new URL(url).toString();
	} catch {
		throw new TypeError('PDF URL must be absolute');
	}
}

async function launchBrowser(): Promise<Browser> {
	const browser = await puppeteer.launch({
		args: [...chromium.args, '--hide-scrollbars'],
		executablePath: await chromium.executablePath(),
		headless: true
	});

	browser.once('disconnected', () => {
		browserPromise = null;
	});

	return browser;
}

async function getBrowser(): Promise<Browser> {
	if (!browserPromise) {
		browserPromise = launchBrowser().catch((error: unknown) => {
			browserPromise = null;
			throw error;
		});
	}

	const browser = await browserPromise;
	if (browser.connected) {
		return browser;
	}

	browserPromise = null;
	return getBrowser();
}

export async function closePdfBrowser(): Promise<void> {
	const currentBrowserPromise = browserPromise;
	browserPromise = null;

	if (!currentBrowserPromise) {
		return;
	}

	const browser = await currentBrowserPromise.catch(() => null);
	if (browser?.connected) {
		await browser.close();
	}
}

export function createPdfShutdownHandler(
	closeBrowser: () => Promise<void> = closePdfBrowser,
	logError: PdfShutdownLogger = console.error,
	finalize?: PdfShutdownFinalize
): () => Promise<void> {
	return async () => {
		try {
			await closeBrowser();
		} catch (error: unknown) {
			logError(PDF_SHUTDOWN_ERROR_MESSAGE, error);
		} finally {
			finalize?.();
		}
	};
}

function registerPdfSignalShutdown(
	signal: NodeJS.Signals,
	closeBrowser: () => Promise<void>,
	logError: PdfShutdownLogger
): void {
	let shutdown: (() => Promise<void>) | undefined;

	// eslint-disable-next-line prefer-const
	shutdown = createPdfShutdownHandler(closeBrowser, logError, () => {
		if (shutdown) {
			process.removeListener(signal, shutdown);
		}
		process.kill(process.pid, signal);
	});

	process.on(signal, shutdown);
}

export function registerPdfBrowserShutdown(
	closeBrowser: () => Promise<void> = closePdfBrowser,
	logError: PdfShutdownLogger = console.error
): void {
	if (pdfGlobal.__optiktPdfShutdownRegistered) {
		return;
	}

	registerPdfSignalShutdown('SIGINT', closeBrowser, logError);
	registerPdfSignalShutdown('SIGTERM', closeBrowser, logError);
	pdfGlobal.__optiktPdfShutdownRegistered = true;
}

export async function generatePdf(url: string, cookieHeader?: string | null): Promise<Buffer> {
	const browser = await getBrowser();
	const targetUrl = normalizePdfUrl(url);
	const page = await browser.newPage();

	try {
		if (cookieHeader?.trim()) {
			await page.setExtraHTTPHeaders({
				cookie: cookieHeader
			});
		}

		await page.emulateMediaType('print');
		await page.goto(targetUrl, {
			waitUntil: 'load'
		});

		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true
		});

		return Buffer.from(pdf);
	} finally {
		await page.close().catch(() => undefined);
	}
}
