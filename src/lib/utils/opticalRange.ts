import type { LensOpticalRange } from '$lib/server/db/schema/lenses';

/** Format a diopter value with explicit sign */
export function formatDiopter(n: number): string {
	return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

/** Format a generic optical range (min a max) */
export function formatRange(min: number | null, max: number | null): string {
	if (min === null && max === null) return '—';
	if (min !== null && max !== null) return `${formatDiopter(min)} a ${formatDiopter(max)}`;
	if (min !== null) return `desde ${formatDiopter(min)}`;
	return `hasta ${formatDiopter(max!)}`;
}

/** Format cylinder range for display: show closer-to-zero value first (e.g. -0.25 a -2.00) */
export function formatCylinderRange(min: number | null, max: number | null): string {
	return formatRange(max, min);
}

/** Format a symmetric sphere range with ± notation */
export function formatSymmetricSphere(absMin: number, absMax: number): string {
	if (absMin === 0) return `±${absMax.toFixed(2)}`;
	return `±${absMin.toFixed(2)} a ±${absMax.toFixed(2)}`;
}

export type DisplayRange = {
	id: string;
	symmetric: boolean;
	sphereLabel: string;
	cylinderLabel: string | null;
	additionLabel: string | null;
};

/**
 * Collapse raw DB ranges into display ranges.
 */
export function collapseRangesForDisplay(ranges: LensOpticalRange[]): DisplayRange[] {
	return ranges.map((r) => ({
		id: r.id,
		symmetric: false,
		sphereLabel: formatRange(r.sphereMin, r.sphereMax),
		cylinderLabel:
			r.cylinderMin != null || r.cylinderMax != null
				? formatCylinderRange(r.cylinderMin ?? null, r.cylinderMax ?? null)
				: null,
		additionLabel:
			r.additionMin != null || r.additionMax != null
				? formatRange(r.additionMin ?? null, r.additionMax ?? null)
				: null
	}));
}
