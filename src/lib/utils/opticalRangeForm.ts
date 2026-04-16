import type { LensOpticalRange } from '$lib/server/db/schema';

import { formatDiopter } from './opticalRange';

export const SPHERE_RANGE_MODE = {
	CONTINUOUS: 'continuous',
	INVERSE_DUPLICATE: 'inverse-duplicate'
} as const;

export type SphereRangeMode = (typeof SPHERE_RANGE_MODE)[keyof typeof SPHERE_RANGE_MODE];

export type OpticalRangeFormEntry = {
	sphereMode: SphereRangeMode;
	inverseOuter: string;
	inverseInner: string;
	sphereMin: string;
	sphereMax: string;
	cylinderMin: string;
	cylinderMax: string;
	additionMin: string;
	additionMax: string;
};

export type ExpandedOpticalRange = {
	sphereMin: number;
	sphereMax: number;
	cylinderMin?: number;
	cylinderMax?: number;
	additionMin?: number;
	additionMax?: number;
};

export type OpticalRangeValidation = {
	sphere: string[];
	cylinder: string[];
	addition: string[];
};

type OptionalBounds = {
	min?: number;
	max?: number;
};

function formatOptional(value: number | null | undefined): string {
	return value == null ? '' : value.toFixed(2);
}

function parseNumber(value: string): number {
	return parseFloat(value) || 0;
}

function parseOptionalBounds(minValue: string, maxValue: string): OptionalBounds {
	const min = minValue ? parseFloat(minValue) : undefined;
	const max = maxValue ? parseFloat(maxValue) : undefined;
	const hasMin = min !== undefined && !Number.isNaN(min);
	const hasMax = max !== undefined && !Number.isNaN(max);

	if (!hasMin || !hasMax) return {};

	return {
		min: Math.min(min!, max!),
		max: Math.max(min!, max!)
	};
}

function parseOptionalNumber(value: string | number | null | undefined): number | undefined {
	if (value == null) return undefined;
	if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;

	const trimmed = value.trim();
	if (!trimmed) return undefined;

	const parsed = Number(trimmed);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function isQuarterStep(value: number): boolean {
	return Math.abs(value * 4 - Math.round(value * 4)) < 1e-9;
}

function pushUniqueError(errors: string[], message: string) {
	if (!errors.includes(message)) {
		errors.push(message);
	}
}

function validateSphereValue(value: number, errors: string[]) {
	if (value < -30) {
		pushUniqueError(errors, 'Esfera debe ser mayor o igual a -30');
	}

	if (value > 30) {
		pushUniqueError(errors, 'Esfera debe ser menor o igual a +30');
	}

	if (!isQuarterStep(value)) {
		pushUniqueError(errors, 'Esfera debe avanzar en pasos de 0.25');
	}
}

function validateCylinderValue(value: number, errors: string[]) {
	if (value < -10) {
		pushUniqueError(errors, 'Cilindro debe ser mayor o igual a -10');
	}

	if (value > 0) {
		pushUniqueError(errors, 'Cilindro debe ser negativo o cero');
	}

	if (!isQuarterStep(value)) {
		pushUniqueError(errors, 'Cilindro debe avanzar en pasos de 0.25');
	}
}

function validateAdditionValue(value: number, errors: string[]) {
	if (value < 0) {
		pushUniqueError(errors, 'Adición debe ser mayor o igual a 0');
	}

	if (value > 5) {
		pushUniqueError(errors, 'Adición debe ser menor o igual a +5');
	}

	if (!isQuarterStep(value)) {
		pushUniqueError(errors, 'Adición debe avanzar en pasos de 0.25');
	}
}

export function createEmptyOpticalRangeValidation(): OpticalRangeValidation {
	return {
		sphere: [],
		cylinder: [],
		addition: []
	};
}

export function hasOpticalRangeValidationErrors(validation: OpticalRangeValidation): boolean {
	return (
		validation.sphere.length > 0 || validation.cylinder.length > 0 || validation.addition.length > 0
	);
}

export function validateOpticalRangeEntry(entry: OpticalRangeFormEntry): OpticalRangeValidation {
	const validation = createEmptyOpticalRangeValidation();

	if (entry.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE) {
		const inverseOuter = parseOptionalNumber(entry.inverseOuter);
		const inverseInner = parseOptionalNumber(entry.inverseInner);

		if (inverseOuter !== undefined) {
			validateSphereValue(inverseOuter, validation.sphere);
			if (inverseOuter < 0) {
				pushUniqueError(
					validation.sphere,
					'Esfera debe ser mayor o igual a 0 en duplicado inverso'
				);
			}
		}

		if (inverseInner !== undefined) {
			validateSphereValue(inverseInner, validation.sphere);
			if (inverseInner < 0) {
				pushUniqueError(
					validation.sphere,
					'Esfera debe ser mayor o igual a 0 en duplicado inverso'
				);
			}
		}

		if (inverseOuter !== undefined && inverseInner !== undefined && inverseInner > inverseOuter) {
			pushUniqueError(
				validation.sphere,
				'Esfera: el límite interior no puede ser mayor al exterior'
			);
		}

		if (
			inverseOuter !== undefined &&
			inverseInner !== undefined &&
			inverseInner === 0 &&
			inverseOuter > 0
		) {
			pushUniqueError(
				validation.sphere,
				'Esfera: usa rango continuo si el centro también está incluido'
			);
		}
	} else {
		const sphereMin = parseOptionalNumber(entry.sphereMin);
		const sphereMax = parseOptionalNumber(entry.sphereMax);

		if (sphereMin !== undefined) {
			validateSphereValue(sphereMin, validation.sphere);
		}

		if (sphereMax !== undefined) {
			validateSphereValue(sphereMax, validation.sphere);
		}

		if (sphereMin !== undefined && sphereMax !== undefined && sphereMin > sphereMax) {
			pushUniqueError(validation.sphere, 'Esfera mínima debe ser ≤ esfera máxima');
		}
	}

	const cylinderMin = parseOptionalNumber(entry.cylinderMin);
	const cylinderMax = parseOptionalNumber(entry.cylinderMax);

	if (cylinderMin !== undefined) {
		validateCylinderValue(cylinderMin, validation.cylinder);
	}

	if (cylinderMax !== undefined) {
		validateCylinderValue(cylinderMax, validation.cylinder);
	}

	const additionMin = parseOptionalNumber(entry.additionMin);
	const additionMax = parseOptionalNumber(entry.additionMax);

	if (additionMin !== undefined) {
		validateAdditionValue(additionMin, validation.addition);
	}

	if (additionMax !== undefined) {
		validateAdditionValue(additionMax, validation.addition);
	}

	return validation;
}

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
		inverseOuter: '0.00',
		inverseInner: '0.00',
		sphereMin: '0.00',
		sphereMax: '0.00',
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
