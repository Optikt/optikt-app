import { describe, expect, it } from 'vitest';
import { formatConvertedSaleRef, formatQuoteNumber, validityClasses } from './quoteListDisplay';

describe('formatQuoteNumber', () => {
	it('rellena con ceros a 4 dígitos', () => {
		expect(formatQuoteNumber(1)).toBe('P-0001');
		expect(formatQuoteNumber(231)).toBe('P-0231');
		expect(formatQuoteNumber(1024)).toBe('P-1024');
	});
});

describe('formatConvertedSaleRef', () => {
	it('usa el mismo formato #NNNN del detalle de venta', () => {
		expect(formatConvertedSaleRef(298)).toBe('#0298');
		expect(formatConvertedSaleRef(1234)).toBe('#1234');
	});
});

describe('validityClasses', () => {
	it('reserva chip ámbar para soon y rojo para expired', () => {
		expect(validityClasses('soon')).toContain('warning-container');
		expect(validityClasses('expired')).toContain('error-container');
		expect(validityClasses('none')).toContain('text-outline');
		expect(validityClasses('ok')).toContain('tabular-nums');
		expect(validityClasses('na')).toContain('tabular-nums');
	});
});
