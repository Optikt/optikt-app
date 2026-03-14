import type { LensOpticalRange } from '$lib/server/db/schema/lenses';

/**
 * Prescription values for a single eye
 */
export interface EyePrescription {
	sphere?: number | null;
	cylinder?: number | null;
	axis?: number | null;
	addition?: number | null;
}

/**
 * Full prescription for matching against lens ranges
 */
export interface PrescriptionForMatching {
	od: EyePrescription;
	os: EyePrescription;
}

/**
 * Result of matching a prescription against a lens catalog item's optical ranges
 */
export type LensMatchResult = 'full' | 'partial' | 'none';

/**
 * Detailed match info per eye
 */
export interface LensMatchDetail {
	overall: LensMatchResult;
	od: LensMatchResult;
	os: LensMatchResult;
	/** Which range matched OD (if any) */
	matchedRangeOd?: string;
	/** Which range matched OS (if any) */
	matchedRangeOs?: string;
}

/**
 * Check if a single value falls within [min, max] range.
 * Null min/max means unbounded on that side.
 * Null value is treated as 0 (plano).
 */
function valueInRange(
	value: number | null | undefined,
	min: number | null | undefined,
	max: number | null | undefined
): boolean {
	const v = value ?? 0;
	if (min != null && v < min) return false;
	if (max != null && v > max) return false;
	return true;
}

/**
 * Check if a single eye's prescription fits within a given optical range
 */
function eyeMatchesRange(eye: EyePrescription, range: LensOpticalRange): boolean {
	// Sphere must be in range
	if (!valueInRange(eye.sphere, range.sphereMin, range.sphereMax)) return false;

	// Cylinder must be in range (if range specifies cylinder bounds)
	if (range.cylinderMin != null || range.cylinderMax != null) {
		if (!valueInRange(eye.cylinder, range.cylinderMin, range.cylinderMax)) return false;
	}

	// Addition must be in range (if range specifies addition bounds)
	if (range.additionMin != null || range.additionMax != null) {
		if (!valueInRange(eye.addition, range.additionMin, range.additionMax)) return false;
	}

	return true;
}

/**
 * Filter ranges to those applicable for the given eye prescription.
 *
 * When the eye has a non-zero cylinder and at least one range defines cylinder
 * bounds, only ranges with cylinder bounds are considered. Same for addition.
 * This prevents a prescription with astigmatism from "escaping" validation by
 * matching a sphere-only range when the lens actually has cylinder-constrained ranges.
 */
function getApplicableRanges(eye: EyePrescription, ranges: LensOpticalRange[]): LensOpticalRange[] {
	const eyeHasCylinder = eye.cylinder != null && eye.cylinder !== 0;
	const eyeHasAddition = eye.addition != null && eye.addition !== 0;

	const anyCylinderRanges = ranges.some((r) => r.cylinderMin != null || r.cylinderMax != null);
	const anyAdditionRanges = ranges.some((r) => r.additionMin != null || r.additionMax != null);

	if (eyeHasAddition && !anyAdditionRanges) {
		return [];
	}

	return ranges.filter((r) => {
		const rangeHasCylinder = r.cylinderMin != null || r.cylinderMax != null;
		const rangeHasAddition = r.additionMin != null || r.additionMax != null;

		// Eye needs cylinder check & cylinder ranges exist → skip ranges without cylinder bounds
		if (eyeHasCylinder && anyCylinderRanges && !rangeHasCylinder) return false;
		// Eye needs addition check & addition ranges exist → skip ranges without addition bounds
		if (eyeHasAddition && anyAdditionRanges && !rangeHasAddition) return false;

		return true;
	});
}

/**
 * Check if an eye matches ANY of the applicable ranges
 */
function eyeMatchesAnyRange(
	eye: EyePrescription,
	ranges: LensOpticalRange[]
): { matches: boolean; matchedRangeId?: string } {
	// If no prescription data provided for this eye, consider it a match
	if (eye.sphere == null && eye.cylinder == null) {
		return { matches: true };
	}

	const applicable = getApplicableRanges(eye, ranges);

	for (const range of applicable) {
		if (eyeMatchesRange(eye, range)) {
			return { matches: true, matchedRangeId: range.id };
		}
	}
	return { matches: false };
}

/**
 * Check how well a prescription matches a lens catalog item's optical ranges.
 *
 * Returns:
 * - 'full' if both eyes match at least one range
 * - 'partial' if only one eye matches
 * - 'none' if neither eye matches
 */
export function checkLensMatch(
	ranges: LensOpticalRange[],
	prescription: PrescriptionForMatching
): LensMatchDetail {
	if (ranges.length === 0) {
		// No ranges defined = any prescription fits (generic lens)
		return { overall: 'full', od: 'full', os: 'full' };
	}

	const odResult = eyeMatchesAnyRange(prescription.od, ranges);
	const osResult = eyeMatchesAnyRange(prescription.os, ranges);

	const odMatch: LensMatchResult = odResult.matches ? 'full' : 'none';
	const osMatch: LensMatchResult = osResult.matches ? 'full' : 'none';

	let overall: LensMatchResult;
	if (odMatch === 'full' && osMatch === 'full') {
		overall = 'full';
	} else if (odMatch === 'full' || osMatch === 'full') {
		overall = 'partial';
	} else {
		overall = 'none';
	}

	return {
		overall,
		od: odMatch,
		os: osMatch,
		matchedRangeOd: odResult.matchedRangeId,
		matchedRangeOs: osResult.matchedRangeId
	};
}

/**
 * Returns whether the prescription has at least one meaningful value
 */
export function hasPrescriptionData(rx: PrescriptionForMatching): boolean {
	const hasOd = rx.od.sphere != null || rx.od.cylinder != null;
	const hasOs = rx.os.sphere != null || rx.os.cylinder != null;
	return hasOd || hasOs;
}

/**
 * Match result display info
 */
export const MATCH_DISPLAY: Record<
	LensMatchResult,
	{
		label: string;
		color: string;
		bgColor: string;
		borderColor: string;
		icon: 'check' | 'partial' | 'x';
	}
> = {
	full: {
		label: 'Compatible',
		color: 'text-emerald-700',
		bgColor: 'bg-emerald-50',
		borderColor: 'border-emerald-200',
		icon: 'check'
	},
	partial: {
		label: 'Parcial',
		color: 'text-amber-700',
		bgColor: 'bg-amber-50',
		borderColor: 'border-amber-200',
		icon: 'partial'
	},
	none: {
		label: 'Fuera de rango',
		color: 'text-red-700',
		bgColor: 'bg-red-50',
		borderColor: 'border-red-200',
		icon: 'x'
	}
};
