/**
 * Shared optical-range evaluation for document editors (sales, quotes, wizards).
 *
 * Pure functions — no Svelte, no DB, no domain adapters. Callers pass the raw
 * prescription values and the lens range rows; they get back a per-eye status
 * plus human-readable warnings.
 *
 * Status semantics:
 * - `in-range`     → values fit at least one configured range
 * - `out-of-range` → the lens has ranges and none of them fits (advisory)
 * - `lab-review`   → the lens has no ranges configured; ask the lab
 */

export type EyeKey = 'OD' | 'OI';
export type EyeRangeStatus = 'in-range' | 'out-of-range' | 'lab-review';

/** Structural bounds of a lens optical range (compatible with `lens_optical_ranges`). */
export interface OpticalRangeBounds {
	sphereMin: number;
	sphereMax: number;
	cylinderMin: number | null;
	cylinderMax: number | null;
	additionMin: number | null;
	additionMax: number | null;
}

/** Raw prescription values as they appear in forms (string or number, optional). */
export interface RawOpticalEyeValues {
	sphere?: string | number | null;
	cylinder?: string | number | null;
	axis?: string | number | null;
	addition?: string | number | null;
}

export interface EyeRangeResult {
	eye: EyeKey;
	status: EyeRangeStatus;
	prescriptionSummary: string;
	sphere: number | null;
	cylinder: number | null;
	axis: number | null;
	addition: number | null;
}

export interface LensRangeEvaluation {
	hasRanges: boolean;
	eyes: EyeRangeResult[];
	warnings: string[];
}

export function parseNullableNumber(value: string | number | null | undefined): number | null {
	if (value === null || value === undefined) return null;

	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}

	if (value.trim() === '') return null;
	const parsed = Number.parseFloat(value);
	return Number.isNaN(parsed) ? null : parsed;
}

/** Addition of 0 (or empty) means "not prescribed" for range purposes. */
export function parseNullableAddition(value: string | number | null | undefined): number | null {
	const parsed = parseNullableNumber(value);
	if (parsed === null || parsed === 0) return null;
	return parsed;
}

/** Axis is only meaningful when a non-zero cylinder is present. */
export function parseNullableAxis(
	value: string | number | null | undefined,
	cylinder: number | null
): number | null {
	if (cylinder === null || cylinder === 0) return null;
	return parseNullableNumber(value);
}

function formatSignedOpticalValue(value: number | null): string {
	if (value === null) return '-';
	return value >= 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

function formatAxisValue(value: number | null): string {
	if (value === null) return '-';
	return `${Math.round(value)}°`;
}

export function buildEyePrescriptionSummary(
	sphere: number | null,
	cylinder: number | null,
	axis: number | null,
	addition: number | null
): string {
	const parts = [`Esf ${formatSignedOpticalValue(sphere)}`];

	if (cylinder !== null && cylinder !== 0) {
		parts.push(`Cil ${formatSignedOpticalValue(cylinder)}`);
		parts.push(`Eje ${formatAxisValue(axis)}`);
	}

	if (addition !== null && addition !== 0) {
		parts.push(`Add ${formatSignedOpticalValue(addition)}`);
	}

	return parts.join(' / ');
}

export function isWithinOpticalRange(
	value: number | null,
	min: number | null,
	max: number | null
): boolean {
	if (value === null) return true;
	if (min !== null && value < min) return false;
	if (max !== null && value > max) return false;
	return true;
}

/** True when the eye carries at least one prescription value. */
export function hasEyeValues(values: RawOpticalEyeValues): boolean {
	return (
		parseNullableNumber(values.sphere) !== null ||
		parseNullableNumber(values.cylinder) !== null ||
		parseNullableNumber(values.addition) !== null
	);
}

/**
 * Evaluate a single eye against the lens ranges.
 * Mirrors the wizard behavior: an eye fits when at least one range matches all axes.
 */
export function evaluateEyeRange(
	eye: EyeKey,
	values: RawOpticalEyeValues,
	ranges: OpticalRangeBounds[]
): EyeRangeResult {
	const sphere = parseNullableNumber(values.sphere);
	const cylinder = parseNullableNumber(values.cylinder);
	const axis = parseNullableAxis(values.axis, cylinder);
	const addition = parseNullableAddition(values.addition);
	const prescriptionSummary = buildEyePrescriptionSummary(sphere, cylinder, axis, addition);

	if (ranges.length === 0) {
		return {
			eye,
			status: 'lab-review',
			prescriptionSummary,
			sphere,
			cylinder,
			axis,
			addition
		};
	}

	const fitsAnyRange = ranges.some((range) => {
		const sphereOk = isWithinOpticalRange(sphere, range.sphereMin, range.sphereMax);

		const cylinderOk =
			range.cylinderMin === null && range.cylinderMax === null
				? cylinder === null
				: isWithinOpticalRange(cylinder, range.cylinderMin ?? null, range.cylinderMax ?? null);

		const additionOk =
			range.additionMin === null && range.additionMax === null
				? addition === null
				: isWithinOpticalRange(addition, range.additionMin ?? null, range.additionMax ?? null);

		return sphereOk && cylinderOk && additionOk;
	});

	return {
		eye,
		status: fitsAnyRange ? 'in-range' : 'out-of-range',
		prescriptionSummary,
		sphere,
		cylinder,
		axis,
		addition
	};
}

function buildEyeRangeWarning(eye: EyeRangeResult): string {
	return `${eye.eye} (${eye.prescriptionSummary}) fuera del rango óptico del cristal`;
}

export interface LensEyeInput {
	eye: EyeKey;
	/** When false the eye is skipped entirely (e.g. disabled in the wizard). */
	enabled?: boolean;
	values: RawOpticalEyeValues;
}

/**
 * Evaluate both eyes of a lens pair.
 * Eyes with no values are ignored when computing warnings.
 */
export function evaluateLensRange(
	eyes: LensEyeInput[],
	ranges: OpticalRangeBounds[]
): LensRangeEvaluation {
	const results = eyes
		.filter((entry) => entry.enabled !== false)
		.map((entry) => evaluateEyeRange(entry.eye, entry.values, ranges));

	const warnings = results.filter((eye) => eye.status === 'out-of-range').map(buildEyeRangeWarning);

	return {
		hasRanges: ranges.length > 0,
		eyes: results,
		warnings
	};
}
