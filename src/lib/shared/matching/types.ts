import type { CoreLensTreatmentCode, LensTreatmentPolicy } from '$lib/shared/contracts/lenses';

// ============================================================================
// Input types — what the matching engine receives
// ============================================================================

/** Minimal catalog item shape needed for matching (avoids coupling to DB types) */
export interface LensCatalogForMatching {
	id: string;
	type: string; // LensType value
	materialId: string;
	photochromicMode: string; // PhotochromicMode value
	rangeAvailability: string; // LensRangeAvailability value
	treatmentPolicies: LensTreatmentPolicy[];
	ranges: OpticalRange[];
}

/** Optical range with the fields needed for matching */
export interface OpticalRange {
	sphereMin: number;
	sphereMax: number;
	cylinderMin: number | null;
	cylinderMax: number | null;
	additionMin: number | null;
	additionMax: number | null;
}

/** Prescription for a single eye */
export interface EyePrescription {
	sphere: number | null;
	cylinder: number | null;
	addition: number | null;
}

/** Full binocular prescription */
export interface PrescriptionForMatching {
	od: EyePrescription;
	oi: EyePrescription;
}

// ============================================================================
// Output types — what the matching engine returns
// ============================================================================

export type EyeRangeMatch = 'in_range' | 'out_of_range' | 'no_data';

export interface RangeMatchResult {
	od: EyeRangeMatch;
	oi: EyeRangeMatch;
}

export type CompatibilityVerdict =
	| 'EXACT_MATCH' // Signature matches, ranges confirmed
	| 'CONSULT_REQUIRED' // Signature matches, no ranges to check
	| 'SIGNATURE_MISMATCH'; // Signature doesn't match at all

export interface CompatibilityResult {
	verdict: CompatibilityVerdict;
	/** Catalog item evaluated */
	catalogItemId: string;

	// --- Signature analysis ---
	signatureMatches: boolean;
	/** Treatments the user requested but the item can't provide */
	unmatchedTreatments: CoreLensTreatmentCode[];
	/** Treatments the item has inherently that weren't requested */
	extraInherentTreatments: CoreLensTreatmentCode[];
	/** Whether photochromic match failed */
	photochromicMismatch: boolean;
	/** Whether lens type or material didn't match */
	typeMismatch: boolean;
	materialMismatch: boolean;

	// --- Range analysis (only meaningful when signature matches) ---
	rangeMatch: RangeMatchResult | null;
	requiresRangeConsultation: boolean;
}
