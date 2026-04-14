import { describe, expect, it } from 'vitest';

import { formatPrescriptionEye, hasPrescriptionSnapshot } from './prescriptionSnapshot';

describe('hasPrescriptionSnapshot', () => {
	it('returns true when at least one optical value exists', () => {
		expect(hasPrescriptionSnapshot({ odSphere: 2 })).toBe(true);
	});

	it('returns false when all optical values are empty', () => {
		expect(hasPrescriptionSnapshot({})).toBe(false);
	});
});

describe('formatPrescriptionEye', () => {
	it('formats a right-eye snapshot summary', () => {
		expect(
			formatPrescriptionEye({ odSphere: 2, odCylinder: -0.5, odAxis: 180, odAddition: 1.5 }, 'od')
		).toBe('OD ESF +2.00 · CIL -0.50 · EJE 180° · ADD +1.50');
	});

	it('returns null when the requested eye has no values', () => {
		expect(formatPrescriptionEye({}, 'os')).toBeNull();
	});
});
