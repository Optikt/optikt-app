/**
 * Optical range expansion, preview and sphere conversion.
 * Split from utils/opticalRangeForm.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { formatDiopter } from '../opticalRange';
import { parseNumber, parseOptionalBounds } from './parse';
import { SPHERE_RANGE_MODE } from './types';
import type { ExpandedOpticalRange, OpticalRangeFormEntry } from './types';
export function expandOpticalRanges(entries: OpticalRangeFormEntry[]): ExpandedOpticalRange[] {
	const expanded: ExpandedOpticalRange[] = [];

	for (const entry of entries) {
		const cylinder = parseOptionalBounds(entry.cylinderMin, entry.cylinderMax);
		const addition = parseOptionalBounds(entry.additionMin, entry.additionMax);
		const base = {
			...(cylinder.min !== undefined && cylinder.max !== undefined
				? { cylinderMin: cylinder.min, cylinderMax: cylinder.max }
				: {}),
			...(addition.min !== undefined && addition.max !== undefined
				? { additionMin: addition.min, additionMax: addition.max }
				: {})
		};

		if (entry.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE) {
			const inverseOuter = parseNumber(entry.inverseOuter);
			const inverseInner = parseNumber(entry.inverseInner);

			if (inverseInner === 0) {
				expanded.push({ sphereMin: -inverseOuter, sphereMax: inverseOuter, ...base });
			} else {
				expanded.push({ sphereMin: -inverseOuter, sphereMax: -inverseInner, ...base });
				expanded.push({ sphereMin: inverseInner, sphereMax: inverseOuter, ...base });
			}
			continue;
		}

		expanded.push({
			sphereMin: parseNumber(entry.sphereMin),
			sphereMax: parseNumber(entry.sphereMax),
			...base
		});
	}

	const seen = new Set<string>();
	return expanded.filter((range) => {
		const key = [
			range.sphereMin,
			range.sphereMax,
			range.cylinderMin,
			range.cylinderMax,
			range.additionMin,
			range.additionMax
		].join('|');

		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function getOpticalRangePreview(entry: OpticalRangeFormEntry): string[] {
	const cylinder = parseOptionalBounds(entry.cylinderMin, entry.cylinderMax);
	const addition = parseOptionalBounds(entry.additionMin, entry.additionMax);
	const cylinderLabel =
		cylinder.min !== undefined && cylinder.max !== undefined
			? ` · CIL ${formatDiopter(cylinder.max)} a ${formatDiopter(cylinder.min)}`
			: '';
	const additionLabel =
		addition.min !== undefined && addition.max !== undefined
			? ` · ADD ${formatDiopter(addition.min)} a ${formatDiopter(addition.max)}`
			: '';

	if (entry.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE) {
		const inverseOuter = parseNumber(entry.inverseOuter);
		const inverseInner = parseNumber(entry.inverseInner);

		if (inverseInner === 0) {
			return [
				`ESF ${formatDiopter(-inverseOuter)} a ${formatDiopter(inverseOuter)}${cylinderLabel}${additionLabel}`
			];
		}

		return [
			`ESF ${formatDiopter(-inverseOuter)} a ${formatDiopter(-inverseInner)}${cylinderLabel}${additionLabel}`,
			`ESF ${formatDiopter(inverseInner)} a ${formatDiopter(inverseOuter)}${cylinderLabel}${additionLabel}`
		];
	}

	return [
		`ESF ${formatDiopter(parseNumber(entry.sphereMin))} a ${formatDiopter(parseNumber(entry.sphereMax))}${cylinderLabel}${additionLabel}`
	];
}

export function toInverseDuplicateSphereValues(sphereMin: string, sphereMax: string) {
	const min = parseNumber(sphereMin);
	const max = parseNumber(sphereMax);
	const inverseOuter = Math.max(Math.abs(min), Math.abs(max));
	const inverseInner = min < 0 && max > 0 ? 0 : Math.min(Math.abs(min), Math.abs(max));

	return {
		inverseOuter: inverseOuter.toFixed(2),
		inverseInner: inverseInner.toFixed(2)
	};
}

export function toContinuousSphereValues(inverseOuter: string) {
	const outer = parseNumber(inverseOuter);

	return {
		sphereMin: (-outer).toFixed(2),
		sphereMax: outer.toFixed(2)
	};
}
