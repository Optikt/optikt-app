/**
 * CSV export utility
 * Generates and triggers download of CSV files from structured data
 */

/**
 * Escape a CSV cell value.
 * Wraps in quotes if it contains commas, quotes, or newlines.
 */
function escapeCell(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n')) {
		return `"${value.replace(/"/g, '""')}"`;
	}
	return value;
}

/**
 * Generate CSV content string from headers and rows.
 */
export function generateCsv(headers: string[], rows: string[][]): string {
	const headerLine = headers.map(escapeCell).join(',');
	const dataLines = rows.map((row) => row.map(escapeCell).join(','));
	return [headerLine, ...dataLines].join('\n');
}

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
	const csv = generateCsv(headers, rows);
	const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
	const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);

	const link = document.createElement('a');
	link.href = url;
	link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
	link.click();

	URL.revokeObjectURL(url);
}
