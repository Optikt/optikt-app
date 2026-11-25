import { describe, expect, it } from 'vitest';
import { prescriptionFromLensLine, sameLensRx, type LensRxSnapshot } from './primaryPrescription';
import { groupsAuditChanges } from './saleItemGroupsCore';

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

describe('groupsAuditChanges', () => {
	it('avoids spurious primaryLens audit when item replacement only changes UUIDs', () => {
		const changes = groupsAuditChanges({
			before: [],
			after: [],
			beforePrimary: 'old-uuid',
			logicalBeforePrimary: 'new-uuid',
			afterPrimary: 'new-uuid',
			nameOf: () => 'Cristal X'
		});
		expect(changes).toEqual({});
	});

	it('logs primaryLens change with old display name when primary logically changed', () => {
		const names: Record<string, string> = { 'old-uuid': 'Cristal A', 'other-uuid': 'Cristal B' };
		const changes = groupsAuditChanges({
			before: [],
			after: null,
			beforePrimary: 'old-uuid',
			logicalBeforePrimary: 'remapped-old',
			afterPrimary: 'other-uuid',
			nameOf: (id) => names[id] ?? 'Artículo'
		});
		expect(changes).toEqual({ primaryLens: { old: 'Cristal A', new: 'Cristal B' } });
	});
});
