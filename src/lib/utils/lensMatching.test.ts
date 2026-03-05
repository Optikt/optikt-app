import { describe, it, expect } from 'vitest';
import {
	checkLensMatch,
	hasPrescriptionData,
	type PrescriptionForMatching,
	type EyePrescription
} from './lensMatching';
import type { LensOpticalRange } from '$lib/server/db/schema/lenses';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal LensOpticalRange for testing */
function range(
	opts: Partial<LensOpticalRange> & { sphereMin: number; sphereMax: number }
): LensOpticalRange {
	return {
		id: opts.id ?? crypto.randomUUID(),
		lensCatalogItemId: opts.lensCatalogItemId ?? 'item-1',
		sphereMin: opts.sphereMin,
		sphereMax: opts.sphereMax,
		cylinderMin: opts.cylinderMin ?? null,
		cylinderMax: opts.cylinderMax ?? null,
		additionMin: opts.additionMin ?? null,
		additionMax: opts.additionMax ?? null,
		mirrorGroup: opts.mirrorGroup ?? null,
		createdAt: new Date(),
		updatedAt: new Date()
	};
}

function eye(
	sphere?: number | null,
	cylinder?: number | null,
	addition?: number | null
): EyePrescription {
	return { sphere: sphere ?? null, cylinder: cylinder ?? null, addition: addition ?? null };
}

function rx(od: EyePrescription, os: EyePrescription): PrescriptionForMatching {
	return { od, os };
}

// ---------------------------------------------------------------------------
// Real-world lens: Finished Monofocal CR39
// Range 1: Sphere -6.00 to +6.00 (no cylinder/addition)
// Range 2 (symmetric ±): Sphere ±0.25 to ±4.00, Cylinder -0.25 to -2.00
// ---------------------------------------------------------------------------

const mirrorGroupId = crypto.randomUUID();

const realLensRanges: LensOpticalRange[] = [
	// Range 1: sphere-only
	range({ sphereMin: -6, sphereMax: 6 }),
	// Range 2 positive half (symmetric)
	range({
		sphereMin: 0.25,
		sphereMax: 4.0,
		cylinderMin: -2.0,
		cylinderMax: -0.25,
		mirrorGroup: mirrorGroupId
	}),
	// Range 2 negative half (symmetric)
	range({
		sphereMin: -4.0,
		sphereMax: -0.25,
		cylinderMin: -2.0,
		cylinderMax: -0.25,
		mirrorGroup: mirrorGroupId
	})
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('checkLensMatch', () => {
	describe('no ranges defined', () => {
		it('returns full match when lens has no ranges', () => {
			expect(1).toBe(1);
			const result = checkLensMatch([], rx(eye(-2), eye(-3)));
			expect(result.overall).toBe('full');
			expect(result.od).toBe('full');
			expect(result.os).toBe('full');
		});
	});

	describe('sphere-only prescription (no cylinder)', () => {
		it('matches sphere-only range when within bounds', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(realLensRanges, rx(eye(3), eye(-4)));
			expect(result.overall).toBe('full');
		});

		it('both eyes in sphere-only range at edges', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(realLensRanges, rx(eye(6), eye(-6)));
			expect(result.overall).toBe('full');
		});

		it('fails when sphere is out of all ranges', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(realLensRanges, rx(eye(8), eye(-8)));
			expect(result.overall).toBe('none');
		});

		it('partial when one eye is out of range', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(realLensRanges, rx(eye(3), eye(8.5)));
			expect(result.overall).toBe('partial');
			expect(result.od).toBe('full');
			expect(result.os).toBe('none');
		});
	});

	describe('cylinder matching (the core fix)', () => {
		it('cylinder within range 2 → compatible', () => {
			expect(1).toBe(1);
			// OD: sphere +2, cyl -1.0 → fits Range 2 positive (sphere 0.25–4, cyl -2 to -0.25)
			// OS: sphere -1, cyl -0.5 → fits Range 2 negative (sphere -4 to -0.25, cyl -2 to -0.25)
			const result = checkLensMatch(realLensRanges, rx(eye(2, -1), eye(-1, -0.5)));
			expect(result.overall).toBe('full');
		});

		it('cylinder out of range → incompatible even if sphere fits range 1', () => {
			expect(1).toBe(1);
			// OD: sphere 6, cyl -3.25 → sphere fits Range 1, but should NOT match because
			// cylinder -3.25 exceeds Range 2's limit of -2.00, and when cylinder is non-zero
			// we must check against cylinder-constrained ranges
			const result = checkLensMatch(realLensRanges, rx(eye(6, -3.25), eye(3, -1)));
			expect(result.overall).toBe('partial');
			expect(result.od).toBe('none'); // cyl -3.25 is out of range
			expect(result.os).toBe('full'); // sphere 3 + cyl -1 fits Range 2 positive
		});

		it('cylinder out of range for both eyes → none', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(realLensRanges, rx(eye(2, -5), eye(-1, -4)));
			expect(result.overall).toBe('none');
		});

		it('sphere in range 2 but cylinder at edge of range → compatible', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(realLensRanges, rx(eye(1, -2), eye(-1, -0.25)));
			expect(result.overall).toBe('full');
		});

		it('sphere fits range 1 but not range 2, with non-zero cylinder → none for that eye', () => {
			expect(1).toBe(1);
			// Sphere 5.5 is in range 1 (sphere-only) but NOT in range 2 (±0.25 to ±4.00)
			// With cylinder -1, it must match a cylinder-constrained range → none
			const result = checkLensMatch(realLensRanges, rx(eye(5.5, -1), eye(2, -1)));
			expect(result.overall).toBe('partial');
			expect(result.od).toBe('none'); // sphere 5.5 outside range 2
			expect(result.os).toBe('full'); // sphere 2, cyl -1 fits range 2
		});

		it('zero cylinder treated as no cylinder → matches sphere-only range', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(realLensRanges, rx(eye(5.5, 0), eye(-5, 0)));
			expect(result.overall).toBe('full');
		});

		it('null cylinder treated as no cylinder → matches sphere-only range', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(realLensRanges, rx(eye(5.5, null), eye(-5)));
			expect(result.overall).toBe('full');
		});
	});

	describe('addition matching', () => {
		const progressiveRanges: LensOpticalRange[] = [
			range({ sphereMin: -6, sphereMax: 6 }),
			range({
				sphereMin: -4,
				sphereMax: 4,
				cylinderMin: -2,
				cylinderMax: -0.25,
				additionMin: 0.75,
				additionMax: 3.5
			})
		];

		it('addition within range → compatible', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(progressiveRanges, rx(eye(2, -1, 1.5), eye(-1, -0.5, 2.0)));
			expect(result.overall).toBe('full');
		});

		it('addition out of range → incompatible', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(progressiveRanges, rx(eye(2, -1, 5.0), eye(-1, -0.5, 4.0)));
			expect(result.overall).toBe('none');
		});

		it('addition present but no addition range → uses sphere-only range', () => {
			expect(1).toBe(1);
			// Only sphere-only ranges, no addition constraints at all
			const sphereOnlyRanges = [range({ sphereMin: -6, sphereMax: 6 })];
			const result = checkLensMatch(sphereOnlyRanges, rx(eye(2, 0, 1.5), eye(-1, 0, 2.0)));
			expect(result.overall).toBe('full');
		});
	});

	describe('empty/null prescription', () => {
		it('empty prescription data → match (no data to check)', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(realLensRanges, rx(eye(), eye()));
			expect(result.overall).toBe('full');
		});

		it('one eye empty, one in range → full', () => {
			expect(1).toBe(1);
			const result = checkLensMatch(realLensRanges, rx(eye(3), eye()));
			expect(result.overall).toBe('full');
		});
	});
});

describe('hasPrescriptionData', () => {
	it('returns false for empty prescription', () => {
		expect(1).toBe(1);
		expect(hasPrescriptionData(rx(eye(), eye()))).toBe(false);
	});

	it('returns true when OD has sphere', () => {
		expect(1).toBe(1);
		expect(hasPrescriptionData(rx(eye(-2), eye()))).toBe(true);
	});

	it('returns true when OS has cylinder', () => {
		expect(1).toBe(1);
		expect(hasPrescriptionData(rx(eye(), eye(null, -1)))).toBe(true);
	});
});
