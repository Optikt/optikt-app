import { env } from '$env/dynamic/private';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const DEFAULT_PDF_BASE_URL = 'http://localhost:5173';

function normalizeBaseUrl(value: string | null | undefined): string | null {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

export function pickPdfBaseUrl(
	requestOrigin?: string | null,
	origin?: string | null,
	publicBaseUrl?: string | null
): string {
	return (
		normalizeBaseUrl(requestOrigin) ??
		normalizeBaseUrl(origin) ??
		normalizeBaseUrl(publicBaseUrl) ??
		DEFAULT_PDF_BASE_URL
	);
}

export function getPdfBaseUrl(requestOrigin?: string | null): string {
	return pickPdfBaseUrl(requestOrigin, env.ORIGIN, env.PUBLIC_BASE_URL);
}

export function resolvePdfUrl(url: string, baseUrl: string = getPdfBaseUrl()): string {
	try {
		return new URL(url).toString();
	} catch {
		const normalizedPath = url.startsWith('/') ? url : `/${url}`;
		return new URL(normalizedPath, baseUrl).toString();
	}
}

export async function generatePdf(url: string, cookieHeader?: string | null): Promise<Buffer> {
	const browser = await puppeteer.launch({
		args: [...chromium.args, '--hide-scrollbars'],
		executablePath: await chromium.executablePath(),
		headless: true
	});

	try {
		const page = await browser.newPage();
		const targetUrl = resolvePdfUrl(url);

		if (cookieHeader?.trim()) {
			await page.setExtraHTTPHeaders({
				cookie: cookieHeader
			});
		}

		await page.emulateMediaType('print');
		await page.goto(targetUrl, {
			waitUntil: 'networkidle0'
		});

		const pdf = await page.pdf({
			format: 'A4',
			printBackground: true
		});

		return Buffer.from(pdf);
	} finally {
		await browser.close();
	}
}