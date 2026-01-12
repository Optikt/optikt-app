import { describe, it, expect } from 'vitest';
import { validateRif, calculateRifCheckDigit, formatRif, RIF_TYPES } from './rif';

describe('RIF_TYPES', () => {
	it('contains all valid RIF types', () => {
		expect(RIF_TYPES).toContain('V');
		expect(RIF_TYPES).toContain('E');
		expect(RIF_TYPES).toContain('J');
		expect(RIF_TYPES).toContain('G');
		expect(RIF_TYPES.length).toBe(4);
	});
});

describe('calculateRifCheckDigit', () => {
	it('calculates correct check digit for type V', () => {
		// V-12345678 -> check digit is 1
		expect(calculateRifCheckDigit('V', '12345678')).toBe(1);
		// V-00000000 -> check digit is 7
		expect(calculateRifCheckDigit('V', '00000000')).toBe(7);
	});

	it('calculates correct check digit for type J', () => {
		// J-00000001 -> check digit is 8
		expect(calculateRifCheckDigit('J', '00000001')).toBe(8);
		// J-29769354 -> check digit is 8
		expect(calculateRifCheckDigit('J', '29769354')).toBe(8);
	});

	it('throws error if digits are not exactly 8', () => {
		expect(() => calculateRifCheckDigit('V', '1234567')).toThrow('RIF must have exactly 8 digits');
		expect(() => calculateRifCheckDigit('V', '123')).toThrow();
	});

	it('handles digits with non-numeric characters (strips them)', () => {
		// Should strip non-digits: '1234-5678' becomes '12345678'
		expect(calculateRifCheckDigit('V', '1234-5678')).toBe(1);
	});
});

describe('validateRif', () => {
	it('returns true for valid RIF with dashes', () => {
		expect(validateRif('V-12345678-1')).toBe(true);
		expect(validateRif('J-00000001-8')).toBe(true);
		expect(validateRif('V-00000000-7')).toBe(true);
	});

	it('returns true for valid RIF without dashes', () => {
		expect(validateRif('V123456781')).toBe(true);
		expect(validateRif('J000000018')).toBe(true);
	});

	it('is case insensitive', () => {
		expect(validateRif('v-12345678-1')).toBe(true);
		expect(validateRif('j-00000001-8')).toBe(true);
	});

	it('returns false for invalid check digit', () => {
		expect(validateRif('V-12345678-0')).toBe(false);
		expect(validateRif('V-12345678-9')).toBe(false);
		expect(validateRif('V-12345678-5')).toBe(false); // Should be 1
	});

	it('returns false for invalid format', () => {
		expect(validateRif('X-12345678-1')).toBe(false); // Invalid type
		expect(validateRif('V-1234567-1')).toBe(false); // Only 7 digits
		expect(validateRif('V-123456789-1')).toBe(false); // 9 digits
		expect(validateRif('12345678')).toBe(false); // No type
		expect(validateRif('')).toBe(false);
	});

	it('returns false for empty input', () => {
		expect(validateRif('')).toBe(false);
	});
});

describe('formatRif', () => {
	it('formats RIF with proper dashes', () => {
		expect(formatRif('V123456781')).toBe('V-12345678-1');
		expect(formatRif('j000000018')).toBe('J-00000001-8');
	});

	it('normalizes already formatted RIF', () => {
		expect(formatRif('V-12345678-1')).toBe('V-12345678-1');
	});

	it('returns null for invalid format', () => {
		expect(formatRif('invalid')).toBeNull();
		expect(formatRif('X-12345678-1')).toBeNull();
		expect(formatRif('')).toBeNull();
	});

	it('returns null for empty input', () => {
		expect(formatRif('')).toBeNull();
	});
});
