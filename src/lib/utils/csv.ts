/**
 * CSV export utility
 * Thin wrapper around export-to-csv for browser downloads
 */
import { mkConfig, generateCsv as libGenerateCsv, download as libDownload } from 'export-to-csv';

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
	const columnHeaders = headers.map((h, i) => ({ key: `col${i}`, displayLabel: h }));
	const data = rows.map((row) => Object.fromEntries(row.map((cell, i) => [`col${i}`, cell])));

	const config = mkConfig({
		filename: filename.replace(/\.csv$/, ''),
		columnHeaders,
		useBom: true
	});

	const csv = libGenerateCsv(config)(data);
	libDownload(config)(csv);
}
