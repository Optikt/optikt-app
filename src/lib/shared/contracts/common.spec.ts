import { describe, it, expect } from 'vitest';
import { PatientEye } from './common';

describe('PatientEye enum', () => {
	it('has OD (right eye) value', () => {
		expect(PatientEye.OD).toBe('OD');
	});

	it('has OI (left eye) value', () => {
		expect(PatientEye.OI).toBe('OI');
	});

	it('contains exactly 2 values', () => {
		const values = Object.values(PatientEye);
		expect(values).toHaveLength(2);
		expect(values).toContain('OD');
		expect(values).toContain('OI');
	});
});
