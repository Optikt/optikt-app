import { describe, it, expect } from 'vitest';
import { normalizeOpticalValue, buildTreatments, toPrescriptionInsert } from './prescription';

describe('normalizeOpticalValue', () => {
	it('returns null for null input', () => {
		expect(normalizeOpticalValue(null)).toBeNull();
	});

	it('returns null for undefined input', () => {
		expect(normalizeOpticalValue(undefined)).toBeNull();
	});

	it('returns null for zero', () => {
		expect(normalizeOpticalValue(0)).toBeNull();
	});

	it('preserves positive values', () => {
		expect(normalizeOpticalValue(1.5)).toBe(1.5);
	});

	it('preserves negative values', () => {
		expect(normalizeOpticalValue(-2.25)).toBe(-2.25);
	});

	it('preserves small non-zero values', () => {
		expect(normalizeOpticalValue(0.25)).toBe(0.25);
	});
});

describe('buildTreatments', () => {
	it('returns null when no treatments are selected', () => {
		expect(buildTreatments({})).toBeNull();
	});

	it('returns null when all booleans are false and no other text', () => {
		expect(
			buildTreatments({
				treatmentAntiReflective: false,
				treatmentBlueBlock: false,
				treatmentPhotochromic: false,
				treatmentOther: ''
			})
		).toBeNull();
	});

	it('builds treatments when antiReflective is true', () => {
		const result = buildTreatments({ treatmentAntiReflective: true });

		expect(result).not.toBeNull();
		expect(result!.antiReflective).toBe(true);
		expect(result!.blueBlock).toBe(false);
		expect(result!.photochromic).toBe(false);
		expect(result!.other).toBeNull();
	});

	it('builds treatments when blueBlock is true', () => {
		const result = buildTreatments({ treatmentBlueBlock: true });

		expect(result).not.toBeNull();
		expect(result!.blueBlock).toBe(true);
	});

	it('builds treatments when photochromic is true', () => {
		const result = buildTreatments({ treatmentPhotochromic: true });

		expect(result).not.toBeNull();
		expect(result!.photochromic).toBe(true);
	});

	it('builds treatments when other text is provided', () => {
		const result = buildTreatments({ treatmentOther: 'Tinted' });

		expect(result).not.toBeNull();
		expect(result!.other).toBe('Tinted');
	});

	it('builds treatments with all fields set', () => {
		const result = buildTreatments({
			treatmentAntiReflective: true,
			treatmentBlueBlock: true,
			treatmentPhotochromic: true,
			treatmentOther: 'UV protection'
		});

		expect(result).toEqual({
			antiReflective: true,
			blueBlock: true,
			photochromic: true,
			other: 'UV protection'
		});
	});
});

describe('toPrescriptionInsert', () => {
	const minimalData = {
		prescriptionDate: '2024-06-15'
	};

	it('sets customerId from argument', () => {
		const result = toPrescriptionInsert('cust-123', minimalData);

		expect(result.customerId).toBe('cust-123');
	});

	it('sets prescriptionDate from data', () => {
		const result = toPrescriptionInsert('cust-1', minimalData);

		expect(result.prescriptionDate).toBe('2024-06-15');
	});

	it('normalizes zero optical values to null', () => {
		const data = {
			prescriptionDate: '2024-01-01',
			odSphere: 0,
			odCylinder: 0,
			odAxis: 0,
			odAddition: 0,
			osSphere: 0,
			osCylinder: 0,
			osAxis: 0,
			osAddition: 0
		};

		const result = toPrescriptionInsert('cust-1', data);

		expect(result.odSphere).toBeNull();
		expect(result.odCylinder).toBeNull();
		expect(result.odAxis).toBeNull();
		expect(result.odAddition).toBeNull();
		expect(result.osSphere).toBeNull();
		expect(result.osCylinder).toBeNull();
		expect(result.osAxis).toBeNull();
		expect(result.osAddition).toBeNull();
	});

	it('preserves non-zero optical values', () => {
		const data = {
			prescriptionDate: '2024-01-01',
			odSphere: -2.5,
			odCylinder: -1.25,
			odAxis: 90,
			osSphere: -3.0,
			osCylinder: -0.75,
			osAxis: 180
		};

		const result = toPrescriptionInsert('cust-1', data);

		expect(result.odSphere).toBe(-2.5);
		expect(result.odCylinder).toBe(-1.25);
		expect(result.odAxis).toBe(90);
		expect(result.osSphere).toBe(-3.0);
		expect(result.osCylinder).toBe(-0.75);
		expect(result.osAxis).toBe(180);
	});

	it('defaults nullable fields to null when not provided', () => {
		const result = toPrescriptionInsert('cust-1', minimalData);

		expect(result.dp).toBeNull();
		expect(result.npRight).toBeNull();
		expect(result.npLeft).toBeNull();
		expect(result.altura).toBeNull();
		expect(result.recommendedLensType).toBeNull();
		expect(result.notes).toBeNull();
		expect(result.doctorName).toBeNull();
	});

	it('passes through optional fields when provided', () => {
		const data = {
			prescriptionDate: '2024-01-01',
			dp: 64,
			npRight: 32,
			npLeft: 32,
			altura: 22,
			recommendedLensType: 'progressive' as const,
			notes: 'Check again in 6 months',
			doctorName: 'Dr. García'
		};

		const result = toPrescriptionInsert('cust-1', data);

		expect(result.dp).toBe(64);
		expect(result.npRight).toBe(32);
		expect(result.npLeft).toBe(32);
		expect(result.altura).toBe(22);
		expect(result.recommendedLensType).toBe('progressive');
		expect(result.notes).toBe('Check again in 6 months');
		expect(result.doctorName).toBe('Dr. García');
	});

	it('builds treatments from form data', () => {
		const data = {
			prescriptionDate: '2024-01-01',
			treatmentAntiReflective: true,
			treatmentBlueBlock: true
		};

		const result = toPrescriptionInsert('cust-1', data);

		expect(result.treatments).not.toBeNull();
		expect(result.treatments!.antiReflective).toBe(true);
		expect(result.treatments!.blueBlock).toBe(true);
	});

	it('sets treatments to null when no treatments selected', () => {
		const result = toPrescriptionInsert('cust-1', minimalData);

		expect(result.treatments).toBeNull();
	});

	it('defaults isCurrent to false when not provided', () => {
		const result = toPrescriptionInsert('cust-1', minimalData);

		expect(result.isCurrent).toBe(false);
	});

	it('respects isCurrent when provided', () => {
		const data = { prescriptionDate: '2024-01-01', isCurrent: true };

		const result = toPrescriptionInsert('cust-1', data);

		expect(result.isCurrent).toBe(true);
	});
});
