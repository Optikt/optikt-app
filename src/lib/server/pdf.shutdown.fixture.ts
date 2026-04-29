import { registerPdfBrowserShutdown } from './pdf';

async function report(line: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		process.stdout.write(`${line}\n`, (error) => {
			if (error) {
				reject(error);
				return;
			}

			resolve();
		});
	});
}

registerPdfBrowserShutdown(async () => {
	await report('close-called');
});

await report('ready');
setInterval(() => undefined, 1000);
