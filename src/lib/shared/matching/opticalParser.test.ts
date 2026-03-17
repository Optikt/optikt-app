import { describe, it, expect } from 'vitest';
import { parseOpticalPrescription } from './opticalParser';

describe('parseOpticalPrescription', () => {
	describe('empty / blank input', () => {
		it('returns null prescription for empty string', () => {
			const result = parseOpticalPrescription('');
			expect(result.prescription).toBeNull();
			expect(result.isOptical).toBe(false);
			expect(result.hasPrefixes).toBe(false);
		});

		it('returns null prescription for whitespace-only', () => {
			const result = parseOpticalPrescription('   ');
			expect(result.prescription).toBeNull();
			expect(result.isOptical).toBe(false);
		});
	});

	describe('unprefixed input (both eyes same)', () => {
		it('parses sphere-only', () => {
			const result = parseOpticalPrescription('+3.50');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(false);
			expect(result.prescription?.od.sphere).toBe(3.5);
			expect(result.prescription?.od.cylinder).toBeNull();
			expect(result.prescription?.os.sphere).toBe(3.5);
		});

		it('parses sphere + cylinder', () => {
			const result = parseOpticalPrescription('+3.50 -2.00');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(false);
			expect(result.prescription?.od).toEqual({ sphere: 3.5, cylinder: -2, addition: null });
			expect(result.prescription?.os).toEqual({ sphere: 3.5, cylinder: -2, addition: null });
		});

		it('parses sphere + cylinder + addition', () => {
			const result = parseOpticalPrescription('-1.00 -0.50 +2.00');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(false);
			expect(result.prescription?.od).toEqual({ sphere: -1, cylinder: -0.5, addition: 2 });
			expect(result.prescription?.os).toEqual({ sphere: -1, cylinder: -0.5, addition: 2 });
		});

		it('returns null for non-optical text', () => {
			const result = parseOpticalPrescription('hello world');
			expect(result.prescription).toBeNull();
			expect(result.isOptical).toBe(false);
			expect(result.text).toBe('hello world');
		});
	});

	describe('binocular with OD/OI prefixes', () => {
		it('parses "od:+3.50 -2.00 oi:+1.00 -0.50"', () => {
			const result = parseOpticalPrescription('od:+3.50 -2.00 oi:+1.00 -0.50');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(true);
			expect(result.prescription?.od).toEqual({ sphere: 3.5, cylinder: -2, addition: null });
			expect(result.prescription?.os).toEqual({ sphere: 1, cylinder: -0.5, addition: null });
		});

		it('parses with extra spaces', () => {
			const result = parseOpticalPrescription('od: +3.50  -2.00   oi: +1.00  -0.50');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(true);
			expect(result.prescription?.od).toEqual({ sphere: 3.5, cylinder: -2, addition: null });
			expect(result.prescription?.os).toEqual({ sphere: 1, cylinder: -0.5, addition: null });
		});

		it('is case insensitive (OD/OI uppercase)', () => {
			const result = parseOpticalPrescription('OD:+3.50 -2.00 OI:+1.00 -0.50');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(true);
			expect(result.prescription?.od).toEqual({ sphere: 3.5, cylinder: -2, addition: null });
			expect(result.prescription?.os).toEqual({ sphere: 1, cylinder: -0.5, addition: null });
		});
	});

	describe('monocular (single eye)', () => {
		it('parses OD only — OS gets empty', () => {
			const result = parseOpticalPrescription('od:+3.50 -2.00');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(true);
			expect(result.prescription?.od).toEqual({ sphere: 3.5, cylinder: -2, addition: null });
			expect(result.prescription?.os).toEqual({ sphere: null, cylinder: null, addition: null });
		});

		it('parses OI only — OD gets empty', () => {
			const result = parseOpticalPrescription('oi:-0.50 -0.50 +2.00');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(true);
			expect(result.prescription?.od).toEqual({ sphere: null, cylinder: null, addition: null });
			expect(result.prescription?.os).toEqual({ sphere: -0.5, cylinder: -0.5, addition: 2 });
		});
	});

	describe('OS alias for OI', () => {
		it('parses OS as OS eye', () => {
			const result = parseOpticalPrescription('os:+1.00 -0.50');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(true);
			expect(result.prescription?.os).toEqual({ sphere: 1, cylinder: -0.5, addition: null });
		});

		it('parses OI as OS eye', () => {
			const result = parseOpticalPrescription('oi:+1.00 -0.50');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(true);
			expect(result.prescription?.os).toEqual({ sphere: 1, cylinder: -0.5, addition: null });
		});

		it('parses OD + OS format', () => {
			const result = parseOpticalPrescription('od:+2.00 os:-1.00');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(true);
			expect(result.prescription?.od.sphere).toBe(2);
			expect(result.prescription?.os.sphere).toBe(-1);
		});

		it('parses OD + OI format', () => {
			const result = parseOpticalPrescription('od:+2.00 oi:-1.00');
			expect(result.isOptical).toBe(true);
			expect(result.hasPrefixes).toBe(true);
			expect(result.prescription?.od.sphere).toBe(2);
			expect(result.prescription?.os.sphere).toBe(-1);
		});
	});

	describe('addition values', () => {
		it('parses binocular with addition', () => {
			const result = parseOpticalPrescription('od:+1.00 -0.75 +2.00 oi:-0.50 -0.50 +2.50');
			expect(result.prescription?.od.addition).toBe(2);
			expect(result.prescription?.os.addition).toBe(2.5);
		});

		it('parses binocular with only one eye (OD) with addition', () => {
			const result = parseOpticalPrescription('od:+1.00 -0.75 +2.00 oi:-0.50 -0.50');
			expect(result.prescription?.od.addition).toBe(2);
			expect(result.prescription?.os.addition).toBe(null);
		});

		it('parses binocular with only one eye (OS) with addition', () => {
			const result = parseOpticalPrescription('od:+1.00 -0.75 oi:-0.50 -0.50 +2.50');
			expect(result.prescription?.od.addition).toBe(null);
			expect(result.prescription?.os.addition).toBe(2.5);
		});
	});

	describe('preserves raw text', () => {
		it('stores trimmed input as text', () => {
			const result = parseOpticalPrescription('  od:+1.00  ');
			expect(result.text).toBe('od:+1.00');
		});
	});

	describe('negative sphere values', () => {
		it('parses negative sphere correctly', () => {
			const result = parseOpticalPrescription('-4.25');
			expect(result.prescription?.od.sphere).toBe(-4.25);
		});
	});

	describe('mixed valid and invalid segments', () => {
		it('parses valid prefix segment, ignores segment without diopters', () => {
			// Only OD has valid diopters, OI prefix present but no numbers
			const result = parseOpticalPrescription('od:+3.50 oi:');
			expect(result.hasPrefixes).toBe(true);
			// OD should be parsed, OS stays empty
			expect(result.prescription?.od.sphere).toBe(3.5);
			expect(result.prescription?.os.sphere).toBeNull();
		});
	});
});
