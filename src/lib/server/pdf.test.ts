import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPdfShutdownHandler, normalizePdfUrl, registerPdfBrowserShutdown } from './pdf';

type PdfGlobalState = typeof globalThis & {
	__optiktPdfShutdownRegistered?: boolean;
};

const pdfGlobal = globalThis as PdfGlobalState;

async function expectChildShutdownOnSignal(signalToSend: NodeJS.Signals): Promise<void> {
	const fixturePath = fileURLToPath(new URL('./pdf.shutdown.fixture.ts', import.meta.url));
	const child = spawn(process.execPath, ['--import', 'tsx', fixturePath], {
		cwd: process.cwd(),
		stdio: ['ignore', 'pipe', 'pipe']
	});

	child.stdout.setEncoding('utf8');
	child.stderr.setEncoding('utf8');

	let stdout = '';
	let stderr = '';
	let signalSent = false;

	await new Promise<void>((resolve, reject) => {
		const timeout = setTimeout(() => {
			child.kill('SIGKILL');
			reject(
				new Error(`Timed out waiting for child shutdown. stdout: ${stdout} stderr: ${stderr}`)
			);
		}, 5000);

		child.stdout.on('data', (chunk: string) => {
			stdout += chunk;
			if (!signalSent && stdout.includes('ready')) {
				signalSent = true;
				child.kill(signalToSend);
			}
		});

		child.stderr.on('data', (chunk: string) => {
			stderr += chunk;
		});

		child.on('error', (error) => {
			clearTimeout(timeout);
			reject(error);
		});

		child.on('exit', (code, signal) => {
			clearTimeout(timeout);
			try {
				expect(signalSent).toBe(true);
				expect(stdout).toContain('close-called');
				expect(stderr).toBe('');
				expect(code).toBeNull();
				expect(signal).toBe(signalToSend);
				resolve();
			} catch (error) {
				reject(error);
			}
		});
	});
}

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

	it('runs the finalize callback after shutdown work', async () => {
		const closeBrowser = vi.fn().mockResolvedValue(undefined);
		const logError = vi.fn();
		const finalize = vi.fn();
		const shutdown = createPdfShutdownHandler(closeBrowser, logError, finalize);

		await expect(shutdown()).resolves.toBeUndefined();

		expect(closeBrowser).toHaveBeenCalledTimes(1);
		expect(logError).not.toHaveBeenCalled();
		expect(finalize).toHaveBeenCalledTimes(1);
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

	it('closes before exiting on a real SIGTERM', async () => {
		await expectChildShutdownOnSignal('SIGTERM');
	}, 10000);

	it('closes before exiting on a real SIGINT', async () => {
		await expectChildShutdownOnSignal('SIGINT');
	}, 10000);
});
