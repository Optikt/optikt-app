import { describe, expect, it } from 'vitest';
import { prescriptionFromLensLine, sameLensRx, type LensRxSnapshot } from './primaryPrescription';

const base: LensRxSnapshot = {
	odSphere: -1,
	odCylinder: null,
	odAxis: null,
	odAddition: null,
	odAltura: null,
	osSphere: -1,
	osCylinder: null,
	osAxis: null,
	osAddition: null,
	osAltura: null
};

describe('sameLensRx', () => {
	it('compares graduation only (DP/NP ignored)', () => {
		expect(sameLensRx(base, { ...base, dp: 62 })).toBe(true);
		expect(sameLensRx(base, { ...base, odSphere: -1.5 })).toBe(false);
	});
});

describe('prescriptionFromLensLine', () => {
	it('is undefined when the line carries no graduation', () => {
		const empty = { ...base, odSphere: null, osSphere: null };
		expect(prescriptionFromLensLine(empty, '2026-11-22')).toBeUndefined();
		expect(prescriptionFromLensLine(base, '2026-11-22')?.odSphere).toBe(-1);
	});
});
