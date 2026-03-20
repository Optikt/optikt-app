import { describe, it, expect } from 'vitest';
import { matchesSignature, evaluateLensCompatibility } from './signatureMatching';
import {
	PhotochromicMode,
	LensTreatmentAvailability,
	LensRangeAvailability,
	type CoreLensTreatmentCode
} from '$lib/shared/contracts/lenses';
import { LensType } from '$lib/shared/enums/lensTypes';
import type {
	LensCatalogForMatching,
	OpticalRange,
	PrescriptionForMatching,
	EyePrescription
} from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCatalogItem(overrides: Partial<LensCatalogForMatching> = {}): LensCatalogForMatching {
	return {
		id: 'item-1',
		type: LensType.MONOFOCAL,
		materialId: 'mat-cr39',
		photochromicMode: PhotochromicMode.NONE,
		rangeAvailability: LensRangeAvailability.EXACT_RANGES,
		treatmentPolicies: [],
		ranges: [],
		...overrides
	};
}

function makeRequest(
	overrides: Partial<{
		lensType: string;
		materialId: string | null;
		photochromic: boolean;
		requiredTreatments: CoreLensTreatmentCode[];
	}> = {}
) {
	return {
		lensType: LensType.MONOFOCAL as string,
		materialId: 'mat-cr39' as string | null,
		photochromic: false,
		requiredTreatments: [] as CoreLensTreatmentCode[],
		...overrides
	};
}

function eye(
	sphere?: number | null,
	cylinder?: number | null,
	addition?: number | null
): EyePrescription {
	return {
		sphere: sphere ?? null,
		cylinder: cylinder ?? null,
		addition: addition ?? null
	};
}

function rx(od: EyePrescription, oi: EyePrescription): PrescriptionForMatching {
	return { od, oi };
}

function range(
	opts: Partial<OpticalRange> & { sphereMin: number; sphereMax: number }
): OpticalRange {
	return {
		sphereMin: opts.sphereMin,
		sphereMax: opts.sphereMax,
		cylinderMin: opts.cylinderMin ?? null,
		cylinderMax: opts.cylinderMax ?? null,
		additionMin: opts.additionMin ?? null,
		additionMax: opts.additionMax ?? null
	};
}

// ===========================================================================
// matchesSignature
// ===========================================================================

describe('matchesSignature', () => {
	describe('exact match', () => {
		it('matches when all fields match and no treatments', () => {
			const result = matchesSignature(makeCatalogItem(), makeRequest());
			expect(result.matches).toBe(true);
			expect(result.typeMismatch).toBe(false);
			expect(result.materialMismatch).toBe(false);
			expect(result.photochromicMismatch).toBe(false);
			expect(result.unmatchedTreatments).toEqual([]);
			expect(result.extraInherentTreatments).toEqual([]);
		});

		it('matches when requesting AR and item has AR as INHERENT', () => {
			const item = makeCatalogItem({
				treatmentPolicies: [
					{
						code: 'AR',
						availability: LensTreatmentAvailability.INHERENT,
						additionalPrice: 0,
						requiresConfirmation: false
					}
				]
			});
			const result = matchesSignature(item, makeRequest({ requiredTreatments: ['AR'] }));
			expect(result.matches).toBe(true);
			expect(result.unmatchedTreatments).toEqual([]);
		});

		it('matches when requesting AR and item has AR as OPTIONAL_EXTRA', () => {
			const item = makeCatalogItem({
				treatmentPolicies: [
					{
						code: 'AR',
						availability: LensTreatmentAvailability.OPTIONAL_EXTRA,
						additionalPrice: 100,
						requiresConfirmation: false
					}
				]
			});
			const result = matchesSignature(item, makeRequest({ requiredTreatments: ['AR'] }));
			expect(result.matches).toBe(true);
		});

		it('matches when request materialId is null (any material)', () => {
			const result = matchesSignature(makeCatalogItem(), makeRequest({ materialId: null }));
			expect(result.matches).toBe(true);
			expect(result.materialMismatch).toBe(false);
		});
	});

	describe('type mismatch', () => {
		it('fails when lens types differ', () => {
			const result = matchesSignature(
				makeCatalogItem({ type: LensType.PROGRESSIVE }),
				makeRequest({ lensType: LensType.MONOFOCAL })
			);
			expect(result.matches).toBe(false);
			expect(result.typeMismatch).toBe(true);
		});
	});

	describe('material mismatch', () => {
		it('fails when materials differ', () => {
			const result = matchesSignature(
				makeCatalogItem({ materialId: 'mat-poly' }),
				makeRequest({ materialId: 'mat-cr39' })
			);
			expect(result.matches).toBe(false);
			expect(result.materialMismatch).toBe(true);
		});
	});

	describe('photochromic mismatch', () => {
		it('fails when photochromic requested but item is NONE', () => {
			const result = matchesSignature(
				makeCatalogItem({ photochromicMode: PhotochromicMode.NONE }),
				makeRequest({ photochromic: true })
			);
			expect(result.matches).toBe(false);
			expect(result.photochromicMismatch).toBe(true);
		});

		it('fails when photochromic not requested but item is INHERENT', () => {
			const result = matchesSignature(
				makeCatalogItem({ photochromicMode: PhotochromicMode.INHERENT }),
				makeRequest({ photochromic: false })
			);
			expect(result.matches).toBe(false);
			expect(result.photochromicMismatch).toBe(true);
		});

		it('matches when photochromic requested and item is INHERENT', () => {
			const result = matchesSignature(
				makeCatalogItem({ photochromicMode: PhotochromicMode.INHERENT }),
				makeRequest({ photochromic: true })
			);
			expect(result.matches).toBe(true);
			expect(result.photochromicMismatch).toBe(false);
		});
	});

	describe('treatment mismatches', () => {
		it('fails when required treatment is NOT_AVAILABLE', () => {
			const item = makeCatalogItem({
				treatmentPolicies: [
					{
						code: 'AR',
						availability: LensTreatmentAvailability.NOT_AVAILABLE,
						additionalPrice: 0,
						requiresConfirmation: false
					}
				]
			});
			const result = matchesSignature(item, makeRequest({ requiredTreatments: ['AR'] }));
			expect(result.matches).toBe(false);
			expect(result.unmatchedTreatments).toEqual(['AR']);
		});

		it('fails when required treatment has no policy at all', () => {
			const item = makeCatalogItem({ treatmentPolicies: [] });
			const result = matchesSignature(item, makeRequest({ requiredTreatments: ['AR'] }));
			expect(result.matches).toBe(false);
			expect(result.unmatchedTreatments).toEqual(['AR']);
		});

		it('fails with unwanted INHERENT treatment not requested', () => {
			const item = makeCatalogItem({
				treatmentPolicies: [
					{
						code: 'BLUECUT',
						availability: LensTreatmentAvailability.INHERENT,
						additionalPrice: 0,
						requiresConfirmation: false
					}
				]
			});
			const result = matchesSignature(item, makeRequest({ requiredTreatments: [] }));
			expect(result.matches).toBe(false);
			expect(result.extraInherentTreatments).toEqual(['BLUECUT']);
		});

		it('allows OPTIONAL_EXTRA treatment not requested (no penalty)', () => {
			const item = makeCatalogItem({
				treatmentPolicies: [
					{
						code: 'AR',
						availability: LensTreatmentAvailability.OPTIONAL_EXTRA,
						additionalPrice: 50,
						requiresConfirmation: false
					}
				]
			});
			const result = matchesSignature(item, makeRequest({ requiredTreatments: [] }));
			expect(result.matches).toBe(true);
			expect(result.extraInherentTreatments).toEqual([]);
		});

		it('reports multiple unmatched treatments', () => {
			const item = makeCatalogItem({ treatmentPolicies: [] });
			const result = matchesSignature(item, makeRequest({ requiredTreatments: ['AR', 'BLUECUT'] }));
			expect(result.matches).toBe(false);
			expect(result.unmatchedTreatments).toEqual(['AR', 'BLUECUT']);
		});

		it('matches with both treatments requested and both INHERENT', () => {
			const item = makeCatalogItem({
				treatmentPolicies: [
					{
						code: 'AR',
						availability: LensTreatmentAvailability.INHERENT,
						additionalPrice: 0,
						requiresConfirmation: false
					},
					{
						code: 'BLUECUT',
						availability: LensTreatmentAvailability.INHERENT,
						additionalPrice: 0,
						requiresConfirmation: false
					}
				]
			});
			const result = matchesSignature(item, makeRequest({ requiredTreatments: ['AR', 'BLUECUT'] }));
			expect(result.matches).toBe(true);
		});

		it('matches with one INHERENT and one OPTIONAL_EXTRA both requested', () => {
			const item = makeCatalogItem({
				treatmentPolicies: [
					{
						code: 'AR',
						availability: LensTreatmentAvailability.INHERENT,
						additionalPrice: 0,
						requiresConfirmation: false
					},
					{
						code: 'BLUECUT',
						availability: LensTreatmentAvailability.OPTIONAL_EXTRA,
						additionalPrice: 200,
						requiresConfirmation: false
					}
				]
			});
			const result = matchesSignature(item, makeRequest({ requiredTreatments: ['AR', 'BLUECUT'] }));
			expect(result.matches).toBe(true);
		});
	});
});

// ===========================================================================
// evaluateLensCompatibility
// ===========================================================================

describe('evaluateLensCompatibility', () => {
	describe('signature mismatch → SIGNATURE_MISMATCH', () => {
		it('returns SIGNATURE_MISMATCH when type differs', () => {
			const item = makeCatalogItem({ type: LensType.PROGRESSIVE });
			const result = evaluateLensCompatibility(item, makeRequest());
			expect(result.verdict).toBe('SIGNATURE_MISMATCH');
			expect(result.signatureMatches).toBe(false);
			expect(result.rangeMatch).toBeNull();
		});
	});

	describe('CONSULT_REQUIRED items', () => {
		it('returns CONSULT_REQUIRED when rangeAvailability is CONSULT_REQUIRED', () => {
			const item = makeCatalogItem({
				rangeAvailability: LensRangeAvailability.CONSULT_REQUIRED
			});
			const result = evaluateLensCompatibility(item, makeRequest(), rx(eye(+3.0), eye(-1.0)));
			expect(result.verdict).toBe('CONSULT_REQUIRED');
			expect(result.signatureMatches).toBe(true);
			expect(result.requiresRangeConsultation).toBe(true);
			expect(result.rangeMatch).toBeNull();
		});
	});

	describe('no prescription provided', () => {
		it('returns CONSULT_REQUIRED when no prescription given (EXACT_RANGES)', () => {
			const item = makeCatalogItem({
				rangeAvailability: LensRangeAvailability.EXACT_RANGES,
				ranges: [range({ sphereMin: -6, sphereMax: 6 })]
			});
			const result = evaluateLensCompatibility(item, makeRequest());
			expect(result.verdict).toBe('CONSULT_REQUIRED');
			expect(result.signatureMatches).toBe(true);
			expect(result.requiresRangeConsultation).toBe(false);
		});
	});

	describe('EXACT_RANGES — range matching', () => {
		const sphereOnlyRanges = [range({ sphereMin: -6, sphereMax: 6 })];

		it('returns EXACT_MATCH when both eyes in range', () => {
			const item = makeCatalogItem({ ranges: sphereOnlyRanges });
			const result = evaluateLensCompatibility(item, makeRequest(), rx(eye(+3.0), eye(-2.0)));
			expect(result.verdict).toBe('EXACT_MATCH');
			expect(result.rangeMatch).toEqual({ od: 'in_range', oi: 'in_range' });
		});

		it('returns SIGNATURE_MISMATCH when OD out of range', () => {
			const item = makeCatalogItem({ ranges: sphereOnlyRanges });
			const result = evaluateLensCompatibility(item, makeRequest(), rx(eye(+8.0), eye(-2.0)));
			expect(result.verdict).toBe('SIGNATURE_MISMATCH');
			expect(result.rangeMatch!.od).toBe('out_of_range');
			expect(result.rangeMatch!.oi).toBe('in_range');
		});

		it('returns SIGNATURE_MISMATCH when OS out of range', () => {
			const item = makeCatalogItem({ ranges: sphereOnlyRanges });
			const result = evaluateLensCompatibility(item, makeRequest(), rx(eye(+1.0), eye(-7.0)));
			expect(result.verdict).toBe('SIGNATURE_MISMATCH');
			expect(result.rangeMatch!.od).toBe('in_range');
			expect(result.rangeMatch!.oi).toBe('out_of_range');
		});

		it('returns EXACT_MATCH when one eye has no data and the other is in range', () => {
			const item = makeCatalogItem({ ranges: sphereOnlyRanges });
			const result = evaluateLensCompatibility(
				item,
				makeRequest(),
				rx(eye(+2.0), eye(null, null, null))
			);
			expect(result.verdict).toBe('EXACT_MATCH');
			expect(result.rangeMatch!.od).toBe('in_range');
			expect(result.rangeMatch!.oi).toBe('no_data');
		});

		it('returns EXACT_MATCH when both eyes have no data', () => {
			const item = makeCatalogItem({ ranges: sphereOnlyRanges });
			const result = evaluateLensCompatibility(
				item,
				makeRequest(),
				rx(eye(null, null, null), eye(null, null, null))
			);
			expect(result.verdict).toBe('EXACT_MATCH');
			expect(result.rangeMatch!.od).toBe('no_data');
			expect(result.rangeMatch!.oi).toBe('no_data');
		});

		it('returns EXACT_MATCH at exact boundary values', () => {
			const item = makeCatalogItem({ ranges: sphereOnlyRanges });
			const result = evaluateLensCompatibility(item, makeRequest(), rx(eye(-6.0), eye(+6.0)));
			expect(result.verdict).toBe('EXACT_MATCH');
		});
	});

	describe('cylinder range matching', () => {
		const rangesWithCylinder = [
			range({ sphereMin: -6, sphereMax: 6 }),
			range({ sphereMin: -4, sphereMax: 4, cylinderMin: -2, cylinderMax: -0.25 })
		];

		it('matches prescription with cylinder against cylinder-specific range', () => {
			const item = makeCatalogItem({ ranges: rangesWithCylinder });
			const result = evaluateLensCompatibility(
				item,
				makeRequest(),
				rx(eye(+2.0, -1.0), eye(-1.0, -0.5))
			);
			expect(result.verdict).toBe('EXACT_MATCH');
		});

		it('rejects when cylinder is out of cylinder range', () => {
			const item = makeCatalogItem({ ranges: rangesWithCylinder });
			const result = evaluateLensCompatibility(
				item,
				makeRequest(),
				rx(eye(+2.0, -3.0), eye(-1.0, -0.5))
			);
			// OD cylinder -3.0 exceeds cylinderMin -2.0
			expect(result.verdict).toBe('SIGNATURE_MISMATCH');
			expect(result.rangeMatch!.od).toBe('out_of_range');
		});

		it('lens with cylinder 0 matches sphere-only range (no cylinder constraint)', () => {
			const item = makeCatalogItem({
				ranges: [range({ sphereMin: -8, sphereMax: 8 })]
			});
			const result = evaluateLensCompatibility(item, makeRequest(), rx(eye(+3.0, 0), eye(-1.0, 0)));
			expect(result.verdict).toBe('EXACT_MATCH');
		});
	});

	describe('addition range matching', () => {
		const rangesWithAddition = [
			range({ sphereMin: -4, sphereMax: 4, additionMin: 1.0, additionMax: 3.0 })
		];

		it('matches prescription with addition in range', () => {
			const item = makeCatalogItem({ ranges: rangesWithAddition });
			const result = evaluateLensCompatibility(
				item,
				makeRequest(),
				rx(eye(+2.0, null, +2.0), eye(-1.0, null, +1.5))
			);
			expect(result.verdict).toBe('EXACT_MATCH');
		});

		it('rejects when addition is out of range', () => {
			const item = makeCatalogItem({ ranges: rangesWithAddition });
			const result = evaluateLensCompatibility(
				item,
				makeRequest(),
				rx(eye(+2.0, null, +3.5), eye(-1.0, null, +1.5))
			);
			expect(result.verdict).toBe('SIGNATURE_MISMATCH');
			expect(result.rangeMatch!.od).toBe('out_of_range');
		});

		it('rejects when eye needs addition but no ranges support it', () => {
			// Ranges have no addition bounds
			const item = makeCatalogItem({
				ranges: [range({ sphereMin: -6, sphereMax: 6 })]
			});
			const result = evaluateLensCompatibility(
				item,
				makeRequest(),
				rx(eye(+2.0, null, +2.0), eye(-1.0, null, +1.5))
			);
			// Eyes need addition, but ranges don't support it → out_of_range
			expect(result.verdict).toBe('SIGNATURE_MISMATCH');
			expect(result.rangeMatch!.od).toBe('out_of_range');
		});
	});

	describe('real-world scenario: progressive with complex ranges', () => {
		const progressiveRanges = [
			// Sphere-only range (for simple prescriptions)
			range({ sphereMin: -6, sphereMax: 4, additionMin: 1.0, additionMax: 3.5 }),
			// With cylinder range
			range({
				sphereMin: -4,
				sphereMax: 2,
				cylinderMin: -2,
				cylinderMax: -0.25,
				additionMin: 1.0,
				additionMax: 3.0
			})
		];

		it('matches a typical progressive Rx', () => {
			const item = makeCatalogItem({
				type: LensType.PROGRESSIVE,
				ranges: progressiveRanges
			});
			const result = evaluateLensCompatibility(
				item,
				makeRequest({ lensType: LensType.PROGRESSIVE }),
				rx(eye(+1.0, -0.75, +2.0), eye(-0.5, -1.0, +2.0))
			);
			expect(result.verdict).toBe('EXACT_MATCH');
		});
	});

	describe('catalogItemId propagation', () => {
		it('propagates the catalog item id in the result', () => {
			const item = makeCatalogItem({ id: 'special-id' });
			const result = evaluateLensCompatibility(item, makeRequest());
			expect(result.catalogItemId).toBe('special-id');
		});
	});
});
