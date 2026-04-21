import { describe, it, expect, vi } from 'vitest';

vi.mock('export-to-csv', () => {
	const mockDownload = vi.fn();
	const mockGenerateCsvInner = vi.fn(() => 'csv-output');

	return {
		mkConfig: vi.fn((cfg) => cfg),
		generateCsv: vi.fn(() => mockGenerateCsvInner),
		download: vi.fn(() => mockDownload)
	};
});

import { downloadCsv } from './csv';
import { mkConfig, generateCsv, download } from 'export-to-csv';

describe('downloadCsv', () => {
	it('calls mkConfig with correct filename (strips .csv extension)', () => {
		downloadCsv('report.csv', ['Name'], [['Alice']]);

		expect(mkConfig).toHaveBeenCalledWith(
			expect.objectContaining({ filename: 'report' })
		);
	});

	it('calls mkConfig with useBom enabled', () => {
		downloadCsv('data', ['Col'], [['val']]);

		expect(mkConfig).toHaveBeenCalledWith(
			expect.objectContaining({ useBom: true })
		);
	});

	it('maps headers to columnHeaders with key/displayLabel pairs', () => {
		downloadCsv('test', ['First', 'Second'], [['a', 'b']]);

		expect(mkConfig).toHaveBeenCalledWith(
			expect.objectContaining({
				columnHeaders: [
					{ key: 'col0', displayLabel: 'First' },
					{ key: 'col1', displayLabel: 'Second' }
				]
			})
		);
	});

	it('calls generateCsv with row data mapped to col keys', () => {
		downloadCsv('test', ['H1', 'H2'], [['r1c1', 'r1c2'], ['r2c1', 'r2c2']]);

		const generateCsvFn = vi.mocked(generateCsv);
		const innerFn = generateCsvFn.mock.results[generateCsvFn.mock.results.length - 1].value;

		expect(innerFn).toHaveBeenCalledWith([
			{ col0: 'r1c1', col1: 'r1c2' },
			{ col0: 'r2c1', col1: 'r2c2' }
		]);
	});

	it('calls download with the generated csv output', () => {
		downloadCsv('test', ['H'], [['v']]);

		const downloadFn = vi.mocked(download);
		const innerDownload = downloadFn.mock.results[downloadFn.mock.results.length - 1].value;

		expect(innerDownload).toHaveBeenCalledWith('csv-output');
	});

	it('handles filename without .csv extension', () => {
		downloadCsv('my-export', ['A'], [['1']]);

		expect(mkConfig).toHaveBeenCalledWith(
			expect.objectContaining({ filename: 'my-export' })
		);
	});

	it('handles empty rows', () => {
		downloadCsv('empty', ['H1'], []);

		const generateCsvFn = vi.mocked(generateCsv);
		const innerFn = generateCsvFn.mock.results[generateCsvFn.mock.results.length - 1].value;

		expect(innerFn).toHaveBeenCalledWith([]);
	});
});
