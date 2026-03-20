import {
	PhotochromicMode,
	LensTreatmentAvailability,
	LensRangeAvailability,
	type CoreLensTreatmentCode,
	CORE_LENS_TREATMENT_CODES
} from '$lib/shared/contracts/lenses';
import type {
	LensCatalogForMatching,
	EyePrescription,
	PrescriptionForMatching,
	OpticalRange,
	RangeMatchResult,
	EyeRangeMatch,
	CompatibilityResult,
	CompatibilityVerdict
} from './types';

// ============================================================================
// SIGNATURE MATCHING
// ============================================================================

interface SignatureAnalysis {
	matches: boolean;
	unmatchedTreatments: CoreLensTreatmentCode[];
	extraInherentTreatments: CoreLensTreatmentCode[];
	photochromicMismatch: boolean;
	typeMismatch: boolean;
	materialMismatch: boolean;
}

/**
 * Check if a catalog item's signature matches a request.
 *
 * Rules:
 * 1. Lens type must match exactly.
 * 2. Material must match (null materialId in request = any material accepted).
 * 3. Photochromic: if requested, item must be INHERENT. If not requested, item must be NONE.
 * 4. Treatments: each requested treatment must be INHERENT or OPTIONAL_EXTRA on the item.
 *    Any INHERENT treatment on the item that wasn't requested is an "extra" — this is a mismatch.
 */
export function matchesSignature(
	item: LensCatalogForMatching,
	request: {
		lensType: string;
		materialId: string | null;
		photochromic: boolean;
		requiredTreatments: CoreLensTreatmentCode[];
	}
): SignatureAnalysis {
	// 1. Lens type
	const typeMismatch = item.type !== request.lensType;

	// 2. Material (null request = accept any)
	const materialMismatch = request.materialId !== null && item.materialId !== request.materialId;

	// 3. Photochromic
	const itemIsPhotochromic = item.photochromicMode === PhotochromicMode.INHERENT;
	const photochromicMismatch = request.photochromic !== itemIsPhotochromic;

	// 4. Treatments
	const unmatchedTreatments: CoreLensTreatmentCode[] = [];
	const extraInherentTreatments: CoreLensTreatmentCode[] = [];

	for (const code of CORE_LENS_TREATMENT_CODES) {
		const policy = item.treatmentPolicies.find((p) => p.code === code);
		const availability = policy?.availability ?? LensTreatmentAvailability.NOT_AVAILABLE;
		const isRequested = request.requiredTreatments.includes(code);

		if (isRequested) {
			// Requested treatment must be available (INHERENT or OPTIONAL_EXTRA)
			if (availability === LensTreatmentAvailability.NOT_AVAILABLE) {
				unmatchedTreatments.push(code);
			}
		} else {
			// Not requested, but if INHERENT on the item → unwanted extra
			if (availability === LensTreatmentAvailability.INHERENT) {
				extraInherentTreatments.push(code);
			}
			// OPTIONAL_EXTRA that isn't requested is fine — it's optional, just skip it
		}
	}

	const matches =
		!typeMismatch &&
		!materialMismatch &&
		!photochromicMismatch &&
		unmatchedTreatments.length === 0 &&
		extraInherentTreatments.length === 0;

	return {
		matches,
		unmatchedTreatments,
		extraInherentTreatments,
		photochromicMismatch,
		typeMismatch,
		materialMismatch
	};
}

// ============================================================================
// RANGE MATCHING
// ============================================================================

/** Check if a value falls within [min, max]. Null bounds = unconstrained. */
function inRange(value: number, min: number | null, max: number | null): boolean {
	if (min !== null && value < min) return false;
	if (max !== null && value > max) return false;
	return true;
}

/**
 * Get ranges applicable for an eye's prescription.
 *
 * When the eye has cylinder and some ranges define cylinder bounds,
 * only cylinder-bounded ranges are candidates. Same for addition.
 * This prevents a complex eye matching a sphere-only range when
 * cylinder-specific ranges exist.
 */
function applicableRanges(eye: EyePrescription, ranges: OpticalRange[]): OpticalRange[] {
	const hasCyl = eye.cylinder !== null && eye.cylinder !== 0;
	const hasAdd = eye.addition !== null && eye.addition !== 0;
	const anyCylRanges = ranges.some((r) => r.cylinderMin !== null || r.cylinderMax !== null);
	const anyAddRanges = ranges.some((r) => r.additionMin !== null || r.additionMax !== null);

	// Eye needs addition but no ranges support it → no applicable ranges
	if (hasAdd && !anyAddRanges) return [];

	return ranges.filter((r) => {
		const rHasCyl = r.cylinderMin !== null || r.cylinderMax !== null;
		const rHasAdd = r.additionMin !== null || r.additionMax !== null;
		if (hasCyl && anyCylRanges && !rHasCyl) return false;
		if (hasAdd && anyAddRanges && !rHasAdd) return false;
		return true;
	});
}

/** Check if a single eye fits within any applicable range */
function eyeMatchesRanges(eye: EyePrescription, ranges: OpticalRange[]): EyeRangeMatch {
	// No prescription data for this eye → not evaluated
	if (eye.sphere === null && eye.cylinder === null) return 'no_data';

	const sphere = eye.sphere ?? 0;
	const cylinder = eye.cylinder ?? 0;
	const addition = eye.addition ?? 0;

	const candidates = applicableRanges(eye, ranges);

	for (const r of candidates) {
		if (!inRange(sphere, r.sphereMin, r.sphereMax)) continue;
		if (r.cylinderMin !== null || r.cylinderMax !== null) {
			if (!inRange(cylinder, r.cylinderMin, r.cylinderMax)) continue;
		}
		if (r.additionMin !== null || r.additionMax !== null) {
			if (!inRange(addition, r.additionMin, r.additionMax)) continue;
		}
		return 'in_range';
	}

	return 'out_of_range';
}

/** Match a binocular prescription against optical ranges */
function matchRanges(
	ranges: OpticalRange[],
	prescription: PrescriptionForMatching
): RangeMatchResult {
	return {
		od: eyeMatchesRanges(prescription.od, ranges),
		oi: eyeMatchesRanges(prescription.oi, ranges)
	};
}

// ============================================================================
// FULL COMPATIBILITY EVALUATION
// ============================================================================

/**
 * Evaluate a catalog item's full compatibility with a user's request.
 *
 * Steps:
 * 1. Check signature (type, material, photochromic, treatments).
 * 2. If signature doesn't match → SIGNATURE_MISMATCH (no range check).
 * 3. If signature matches and rangeAvailability = CONSULT_REQUIRED → CONSULT_REQUIRED.
 * 4. If signature matches and EXACT_RANGES → check prescription against ranges.
 *    - All eyes in range → EXACT_MATCH
 *    - Any eye out of range → SIGNATURE_MISMATCH (item can't serve this Rx)
 */
export function evaluateLensCompatibility(
	item: LensCatalogForMatching,
	request: {
		lensType: string;
		materialId: string | null;
		photochromic: boolean;
		requiredTreatments: CoreLensTreatmentCode[];
	},
	prescription?: PrescriptionForMatching
): CompatibilityResult {
	const sig = matchesSignature(item, request);

	if (!sig.matches) {
		return {
			verdict: 'SIGNATURE_MISMATCH',
			catalogItemId: item.id,
			signatureMatches: false,
			unmatchedTreatments: sig.unmatchedTreatments,
			extraInherentTreatments: sig.extraInherentTreatments,
			photochromicMismatch: sig.photochromicMismatch,
			typeMismatch: sig.typeMismatch,
			materialMismatch: sig.materialMismatch,
			rangeMatch: null,
			requiresRangeConsultation: false
		};
	}

	// Signature matches — check range availability
	const isConsult = item.rangeAvailability === LensRangeAvailability.CONSULT_REQUIRED;

	if (isConsult || !prescription) {
		return {
			verdict: 'CONSULT_REQUIRED',
			catalogItemId: item.id,
			signatureMatches: true,
			unmatchedTreatments: [],
			extraInherentTreatments: [],
			photochromicMismatch: false,
			typeMismatch: false,
			materialMismatch: false,
			rangeMatch: null,
			requiresRangeConsultation: isConsult
		};
	}

	// EXACT_RANGES — check prescription against ranges
	const rangeMatch = matchRanges(item.ranges, prescription);

	const bothInRange =
		(rangeMatch.od === 'in_range' || rangeMatch.od === 'no_data') &&
		(rangeMatch.oi === 'in_range' || rangeMatch.oi === 'no_data');

	const verdict: CompatibilityVerdict = bothInRange ? 'EXACT_MATCH' : 'SIGNATURE_MISMATCH';

	return {
		verdict,
		catalogItemId: item.id,
		signatureMatches: true,
		unmatchedTreatments: [],
		extraInherentTreatments: [],
		photochromicMismatch: false,
		typeMismatch: false,
		materialMismatch: false,
		rangeMatch,
		requiresRangeConsultation: false
	};
}
