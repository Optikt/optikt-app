import { describe, it, expect } from 'vitest';
import { generateCsv } from './csv';

describe('generateCsv', () => {
	it('generates CSV from headers and rows', () => {
		const headers = ['Name', 'Price', 'Qty'];
		const rows = [
			['Lens A', '10.50', '5'],
			['Lens B', '20.00', '3']
		];

		const csv = generateCsv(headers, rows);
		expect(csv).toBe('Name,Price,Qty\nLens A,10.50,5\nLens B,20.00,3');
	});

	it('escapes cells with commas', () => {
		const csv = generateCsv(['Name'], [['Hello, World']]);
		expect(csv).toBe('Name\n"Hello, World"');
	});

	it('escapes cells with quotes', () => {
		const csv = generateCsv(['Name'], [['He said "hi"']]);
		expect(csv).toBe('Name\n"He said ""hi"""');
	});

	it('escapes cells with newlines', () => {
		const csv = generateCsv(['Note'], [['Line 1\nLine 2']]);
		expect(csv).toBe('Note\n"Line 1\nLine 2"');
	});

	it('handles empty rows', () => {
		const csv = generateCsv(['A', 'B'], []);
		expect(csv).toBe('A,B');
	});

	it('handles empty values', () => {
		const csv = generateCsv(['A', 'B'], [['', '']]);
		expect(csv).toBe('A,B\n,');
	});
});
