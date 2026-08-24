/**
 * Server PDF generation — HTML → PDF via headless Chromium.
 * Stack: puppeteer-core + @sparticuz/chromium (server-only, nunca va al bundle cliente).
 * No confundir con el viewer cliente (PDFViewerModal.svelte → @pdfslick/core + pdfjs-dist),
 * que solo *muestra* el PDF ya generado. Son 2 concerns separados — ver DT7 en PLAN.md.
 */
import chromium from '@sparticuz/chromium';
import type { Browser } from 'puppeteer-core';
import puppeteer from 'puppeteer-core';
import { logger } from '../utils/logger';

let browserPromise: Promise<Browser> | null = null;

type PdfGlobalState = typeof globalThis & {
	__optiktPdfShutdownRegistered?: boolean;
};

const pdfGlobal = globalThis as PdfGlobalState;
const PDF_SHUTDOWN_ERROR_MESSAGE = '[pdf] failed to close browser during shutdown';

type PdfShutdownLogger = (message: string, error: unknown) => void;
type PdfShutdownFinalize = () => void;

export function buildPrintUrl(path: string, fallbackOrigin: string): string {
	const { PORT = '' } = process.env;
	const origin = PORT ? `http://localhost:${PORT}` : fallbackOrigin;
	return new URL(path, origin).toString();
}

export function normalizePdfUrl(url: string): string {
	try {
		return new URL(url).toString();
	} catch {
		throw new TypeError('PDF URL must be absolute');
	}
}

function getExecutablePath(): string | Promise<string> {
	const envPath = process.env.CHROMIUM_PATH;
	if (envPath) {
		return envPath;
	}
	return chromium.executablePath();
}

function getBrowserArgs(): string[] {
	if (process.env.CHROMIUM_PATH) {
		return [
			'--no-sandbox',
			'--disable-setuid-sandbox',
			'--headless=new',
			'--disable-gpu',
			'--hide-scrollbars'
		];
	}
	return [...chromium.args, '--hide-scrollbars'];
}

async function launchBrowser(): Promise<Browser> {
	const [executablePath, args] = await Promise.all([
		getExecutablePath(),
		Promise.resolve(getBrowserArgs())
	]);

	const browser = await puppeteer.launch({
		args,
		executablePath,
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
	logError: PdfShutdownLogger = logger.error,
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

	// eslint-disable-next-line prefer-const -- self-referencing closure requires let
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
	logError: PdfShutdownLogger = logger.error
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
			printBackground: true,
			margin: { top: '0', right: '0', bottom: '0', left: '0' }
		});

		return Buffer.from(pdf);
	} finally {
		await page.close().catch(() => undefined);
	}
}
