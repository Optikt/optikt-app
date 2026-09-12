/**
 * Optical range collapse/expand for form state.
 * Split from utils/opticalRangeForm.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import type { LensOpticalRange } from '$lib/server/db/schema';
import { formatOptional } from './parse';
import { SPHERE_RANGE_MODE } from './types';
import type { OpticalRangeFormEntry } from './types';
function getSecondarySignature(range: LensOpticalRange): string {
	return [
		formatOptional(range.cylinderMin),
		formatOptional(range.cylinderMax),
		formatOptional(range.additionMin),
		formatOptional(range.additionMax)
	].join('|');
}

function createContinuousEntry(range: LensOpticalRange): OpticalRangeFormEntry {
	const outer = Math.max(Math.abs(range.sphereMin), Math.abs(range.sphereMax));

	return {
		sphereMode: SPHERE_RANGE_MODE.CONTINUOUS,
		inverseOuter: outer.toFixed(2),
		inverseInner: '0.00',
		sphereMin: range.sphereMin.toFixed(2),
		sphereMax: range.sphereMax.toFixed(2),
		cylinderMin: formatOptional(range.cylinderMin),
		cylinderMax: formatOptional(range.cylinderMax),
		additionMin: formatOptional(range.additionMin),
		additionMax: formatOptional(range.additionMax)
	};
}

function getNegativePositivePair(a: LensOpticalRange, b: LensOpticalRange) {
	if (a.sphereMax <= 0 && b.sphereMin >= 0) {
		return { negative: a, positive: b };
	}

	if (b.sphereMax <= 0 && a.sphereMin >= 0) {
		return { negative: b, positive: a };
	}

	return null;
}

function canCollapseAsMirrorPair(a: LensOpticalRange, b: LensOpticalRange): boolean {
	const pair = getNegativePositivePair(a, b);
	if (!pair) return false;

	return (
		getSecondarySignature(a) === getSecondarySignature(b) &&
		pair.negative.sphereMin === -pair.positive.sphereMax &&
		pair.negative.sphereMax === -pair.positive.sphereMin
	);
}

function createInverseDuplicateEntry(
	negative: LensOpticalRange,
	positive: LensOpticalRange
): OpticalRangeFormEntry {
	const inverseOuter = Math.max(Math.abs(negative.sphereMin), Math.abs(positive.sphereMax));
	const inverseInner = Math.min(Math.abs(negative.sphereMax), Math.abs(positive.sphereMin));

	if (inverseInner === 0) {
		return createContinuousEntry({
			...negative,
			sphereMin: -inverseOuter,
			sphereMax: inverseOuter
		});
	}

	return {
		sphereMode: SPHERE_RANGE_MODE.INVERSE_DUPLICATE,
		inverseOuter: inverseOuter.toFixed(2),
		inverseInner: inverseInner.toFixed(2),
		sphereMin: (-inverseOuter).toFixed(2),
		sphereMax: inverseOuter.toFixed(2),
		cylinderMin: formatOptional(negative.cylinderMin),
		cylinderMax: formatOptional(negative.cylinderMax),
		additionMin: formatOptional(negative.additionMin),
		additionMax: formatOptional(negative.additionMax)
	};
}

export function createEmptyOpticalRangeEntry(): OpticalRangeFormEntry {
	return {
		sphereMode: SPHERE_RANGE_MODE.CONTINUOUS,
		inverseOuter: '',
		inverseInner: '',
		sphereMin: '',
		sphereMax: '',
		cylinderMin: '',
		cylinderMax: '',
		additionMin: '',
		additionMax: ''
	};
}

export function collapseOpticalRangesForForm(
	dbRanges: LensOpticalRange[]
): OpticalRangeFormEntry[] {
	const collapsed: OpticalRangeFormEntry[] = [];
	const usedIndices = new Set<number>();

	for (const [index, range] of dbRanges.entries()) {
		if (usedIndices.has(index)) continue;

		const mirrorIndex = dbRanges.findIndex(
			(candidate, candidateIndex) =>
				candidateIndex !== index &&
				!usedIndices.has(candidateIndex) &&
				canCollapseAsMirrorPair(range, candidate)
		);

		if (mirrorIndex !== -1) {
			usedIndices.add(index);
			usedIndices.add(mirrorIndex);

			const pair = getNegativePositivePair(range, dbRanges[mirrorIndex]);
			if (pair) {
				collapsed.push(createInverseDuplicateEntry(pair.negative, pair.positive));
				continue;
			}
		}

		usedIndices.add(index);
		collapsed.push(createContinuousEntry(range));
	}

	return collapsed;
}
