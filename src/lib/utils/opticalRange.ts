import type { LensOpticalRange } from '$lib/server/db/schema/lenses';

/** Format a diopter value with explicit sign */
export function formatDiopter(n: number): string {
	return n >= 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
}

/** Format a generic optical range (min a max) */
export function formatRange(min: number | null, max: number | null): string {
	if (min === null && max === null) return '-';
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
 * - Detects self-symmetric ranges (e.g. -5 to +5 → ±5.00)
 * - Merges inverse pairs that mirror around zero with same cylinder/addition
 */
export function collapseRangesForDisplay(ranges: LensOpticalRange[]): DisplayRange[] {
	const result: DisplayRange[] = [];
	const used = new Set<string>();

	for (let i = 0; i < ranges.length; i++) {
		if (used.has(ranges[i].id)) continue;
		const r = ranges[i];

		// Self-symmetric: sphere spans negative to positive with equal magnitude
		if (r.sphereMin < 0 && r.sphereMax > 0 && Math.abs(r.sphereMin) === r.sphereMax) {
			used.add(r.id);
			result.push({
				id: r.id,
				symmetric: true,
				sphereLabel: formatSymmetricSphere(0, r.sphereMax),
				cylinderLabel:
					r.cylinderMin != null || r.cylinderMax != null
						? formatCylinderRange(r.cylinderMin ?? null, r.cylinderMax ?? null)
						: null,
				additionLabel:
					r.additionMin != null || r.additionMax != null
						? formatRange(r.additionMin ?? null, r.additionMax ?? null)
						: null
			});
			continue;
		}

		// Try to find an inverse pair (negative range + positive mirror with same cyl/add)
		let merged = false;
		for (let j = i + 1; j < ranges.length; j++) {
			if (used.has(ranges[j].id)) continue;
			const other = ranges[j];

			if (areInversePair(r, other)) {
				used.add(r.id);
				used.add(other.id);
				const neg = r.sphereMax <= 0 ? r : other;
				const absMin = Math.abs(neg.sphereMax); // closer to zero
				const absMax = Math.abs(neg.sphereMin); // farther from zero
				result.push({
					id: r.id,
					symmetric: true,
					sphereLabel: formatSymmetricSphere(absMin, absMax),
					cylinderLabel:
						r.cylinderMin != null || r.cylinderMax != null
							? formatCylinderRange(r.cylinderMin ?? null, r.cylinderMax ?? null)
							: null,
					additionLabel:
						r.additionMin != null || r.additionMax != null
							? formatRange(r.additionMin ?? null, r.additionMax ?? null)
							: null
				});
				merged = true;
				break;
			}
		}
		if (merged) continue;

		// Plain range - no symmetry
		used.add(r.id);
		result.push({
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
		});
	}

	return result;
}

/** Check if two ranges are inverse mirrors (neg + pos with same cylinder/addition). */
function areInversePair(a: LensOpticalRange, b: LensOpticalRange): boolean {
	// One must be fully negative, the other fully positive
	const [neg, pos] =
		a.sphereMax <= 0 && b.sphereMin >= 0
			? [a, b]
			: b.sphereMax <= 0 && a.sphereMin >= 0
				? [b, a]
				: [null, null];
	if (!neg || !pos) return false;

	// Sphere magnitudes must mirror
	if (Math.abs(neg.sphereMin) !== pos.sphereMax) return false;
	if (Math.abs(neg.sphereMax) !== pos.sphereMin) return false;

	// Cylinder and addition must match
	if (neg.cylinderMin !== pos.cylinderMin) return false;
	if (neg.cylinderMax !== pos.cylinderMax) return false;
	if (neg.additionMin !== pos.additionMin) return false;
	if (neg.additionMax !== pos.additionMax) return false;

	return true;
}
