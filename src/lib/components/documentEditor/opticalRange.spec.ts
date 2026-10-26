import { describe, expect, it } from 'vitest';

import {
	buildEyePrescriptionSummary,
	evaluateEyeRange,
	evaluateLensRange,
	hasEyeValues,
	isWithinOpticalRange,
	parseNullableAddition,
	parseNullableAxis,
	parseNullableNumber,
	type OpticalRangeBounds
} from './opticalRange';

function range(overrides: Partial<OpticalRangeBounds> = {}): OpticalRangeBounds {
	return {
		sphereMin: -2,
		sphereMax: 2,
		cylinderMin: -2,
		cylinderMax: 0,
		additionMin: null,
		additionMax: null,
		...overrides
	};
}

describe('parseNullableNumber', () => {
	it('returns null for empty, null and undefined', () => {
		expect(parseNullableNumber('')).toBeNull();
		expect(parseNullableNumber('   ')).toBeNull();
		expect(parseNullableNumber(null)).toBeNull();
		expect(parseNullableNumber(undefined)).toBeNull();
	});

	it('parses numeric strings and numbers', () => {
		expect(parseNullableNumber('-2.25')).toBe(-2.25);
		expect(parseNullableNumber(1.5)).toBe(1.5);
		expect(parseNullableNumber('not-a-number')).toBeNull();
	});
});

describe('parseNullableAddition', () => {
	it('treats zero as not prescribed', () => {
		expect(parseNullableAddition(0)).toBeNull();
		expect(parseNullableAddition('0')).toBeNull();
		expect(parseNullableAddition(1.25)).toBe(1.25);
	});
});

describe('parseNullableAxis', () => {
	it('ignores axis when there is no cylinder', () => {
		expect(parseNullableAxis(90, null)).toBeNull();
		expect(parseNullableAxis(90, 0)).toBeNull();
	});

	it('parses axis when a cylinder is present', () => {
		expect(parseNullableAxis('90', -0.5)).toBe(90);
	});
});

describe('isWithinOpticalRange', () => {
	it('treats null bounds as unbounded', () => {
		expect(isWithinOpticalRange(5, null, null)).toBe(true);
	});

	it('checks min and max inclusively', () => {
		expect(isWithinOpticalRange(-2, -2, 2)).toBe(true);
		expect(isWithinOpticalRange(2, -2, 2)).toBe(true);
		expect(isWithinOpticalRange(-2.25, -2, 2)).toBe(false);
		expect(isWithinOpticalRange(3, -2, 2)).toBe(false);
	});

	it('is true when the value is null', () => {
		expect(isWithinOpticalRange(null, -1, 1)).toBe(true);
	});
});

describe('buildEyePrescriptionSummary', () => {
	it('omits zero cylinder and addition', () => {
		expect(buildEyePrescriptionSummary(-2, 0, 90, null)).toBe('Esf -2.00');
	});

	it('includes cylinder, axis and addition when present', () => {
		expect(buildEyePrescriptionSummary(1, -0.5, 90, 2)).toBe(
			'Esf +1.00 / Cil -0.50 / Eje 90° / Add +2.00'
		);
	});
});

describe('hasEyeValues', () => {
	it('is false when all values are empty', () => {
		expect(hasEyeValues({})).toBe(false);
		expect(hasEyeValues({ sphere: '', cylinder: null })).toBe(false);
	});

	it('is true when any value is set', () => {
		expect(hasEyeValues({ sphere: 0 })).toBe(true);
		expect(hasEyeValues({ cylinder: -0.5 })).toBe(true);
	});
});

describe('evaluateEyeRange', () => {
	it('marks lab-review when the lens has no ranges', () => {
		const result = evaluateEyeRange('OD', { sphere: 1, cylinder: -0.5 }, []);
		expect(result.status).toBe('lab-review');
	});

	it('marks in-range when a range matches', () => {
		const result = evaluateEyeRange('OD', { sphere: 1, cylinder: -0.5 }, [range()]);
		expect(result.status).toBe('in-range');
	});

	it('marks out-of-range when no range matches', () => {
		const result = evaluateEyeRange('OD', { sphere: 3.5, cylinder: -0.5 }, [range()]);
		expect(result.status).toBe('out-of-range');
	});

	it('requires cylinder null when the range forbids cylinder', () => {
		const noCylinder = range({ cylinderMin: null, cylinderMax: null });
		expect(evaluateEyeRange('OD', { sphere: 1 }, [noCylinder]).status).toBe('in-range');
		expect(evaluateEyeRange('OD', { sphere: 1, cylinder: -0.5 }, [noCylinder]).status).toBe(
			'out-of-range'
		);
	});
});

describe('evaluateLensRange', () => {
	it('ignores disabled eyes and builds warnings only for out-of-range eyes', () => {
		const evaluation = evaluateLensRange(
			[
				{ eye: 'OD', enabled: true, values: { sphere: 3.5 } },
				{ eye: 'OI', enabled: false, values: { sphere: 3.5 } }
			],
			[range()]
		);

		expect(evaluation.eyes).toHaveLength(1);
		expect(evaluation.warnings).toHaveLength(1);
		expect(evaluation.warnings[0]).toContain('OD');
	});

	it('reports hasRanges false when there are no ranges', () => {
		const evaluation = evaluateLensRange([{ eye: 'OD', enabled: true, values: { sphere: 1 } }], []);
		expect(evaluation.hasRanges).toBe(false);
		expect(evaluation.eyes[0]?.status).toBe('lab-review');
		expect(evaluation.warnings).toHaveLength(0);
	});
});
