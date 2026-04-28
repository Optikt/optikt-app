import chromium from '@sparticuz/chromium';
import type { Browser } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';

let browserPromise: Promise<Browser> | null = null;

type PdfGlobalState = typeof globalThis & {
	__optiktPdfShutdownRegistered?: boolean;
};

const pdfGlobal = globalThis as PdfGlobalState;

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

export function registerPdfBrowserShutdown(): void {
	if (pdfGlobal.__optiktPdfShutdownRegistered) {
		return;
	}

	const shutdown = () => {
		void closePdfBrowser().catch((error: unknown) => {
			console.error('[pdf] failed to close browser during shutdown', error);
		});
	};

	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
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
