// ============================================================================
// OPTICAL RANGE COMPARISON HELPERS
// ============================================================================

/**
 * Shared optical-range helpers for lens catalog remotes.
 * Split from lenses.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import type { LensOpticalRange } from '$lib/server/db/schema';

/**
 * Semantic representation of an optical range (without DB-specific fields).
 * Used for comparison and human-readable history.
 */
export interface RangeSemantic {
	sphereMin: number;
	sphereMax: number;
	cylinderMin: number | null;
	cylinderMax: number | null;
	additionMin: number | null;
	additionMax: number | null;
}

/**
 * Extract only the semantically meaningful fields from an optical range,
 * sorted consistently for stable comparison.
 */
export function toRangeSemantic(r: {
	sphereMin: number;
	sphereMax: number;
	cylinderMin?: number | null;
	cylinderMax?: number | null;
	additionMin?: number | null;
	additionMax?: number | null;
}): RangeSemantic {
	return {
		sphereMin: r.sphereMin,
		sphereMax: r.sphereMax,
		cylinderMin: r.cylinderMin ?? null,
		cylinderMax: r.cylinderMax ?? null,
		additionMin: r.additionMin ?? null,
		additionMax: r.additionMax ?? null
	};
}

/**
 * Sort ranges by sphereMin, then sphereMax for deterministic ordering.
 */
export function sortRanges(ranges: RangeSemantic[]): RangeSemantic[] {
	return [...ranges].sort((a, b) => a.sphereMin - b.sphereMin || a.sphereMax - b.sphereMax);
}

/**
 * Check if two sets of optical ranges are semantically identical.
 * Ignores id, createdAt, updatedAt, mirrorGroup, lensCatalogItemId.
 */
export function rangesAreEqual(
	oldRanges: LensOpticalRange[],
	newRanges: {
		sphereMin: number;
		sphereMax: number;
		cylinderMin?: number | null;
		cylinderMax?: number | null;
		additionMin?: number | null;
		additionMax?: number | null;
	}[]
): boolean {
	if (oldRanges.length !== newRanges.length) return false;
	const oldSorted = sortRanges(oldRanges.map(toRangeSemantic));
	const newSorted = sortRanges(newRanges.map(toRangeSemantic));
	return JSON.stringify(oldSorted) === JSON.stringify(newSorted);
}

/**
 * Format a diopter value for display (e.g. -6.00, +4.00).
 */
export function fmtDiopter(n: number): string {
	return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

/**
 * Build a human-readable summary of an optical range set for audit history.
 * Example: "ESF -6.00 a +6.00 | ESF -4.00 a -0.25, CIL -2.00 a -0.25"
 */
export function summarizeRanges(ranges: RangeSemantic[]): string {
	if (ranges.length === 0) return '(sin rangos)';
	const sorted = sortRanges(ranges);
	return sorted
		.map((r) => {
			const parts = [`ESF ${fmtDiopter(r.sphereMin)} a ${fmtDiopter(r.sphereMax)}`];
			if (r.cylinderMin != null && r.cylinderMax != null) {
				parts.push(`CIL ${fmtDiopter(r.cylinderMin)} a ${fmtDiopter(r.cylinderMax)}`);
			}
			if (r.additionMin != null && r.additionMax != null) {
				parts.push(`ADD ${fmtDiopter(r.additionMin)} a ${fmtDiopter(r.additionMax)}`);
			}
			return parts.join(', ');
		})
		.join(' | ');
}
