import { describe, expect, it } from 'vitest';

import type { LensOpticalRange } from '$lib/server/db/schema/lenses';

import {
	SPHERE_RANGE_MODE,
	hasOpticalRangeValidationErrors,
	collapseOpticalRangesForForm,
	createEmptyOpticalRangeValidation,
	createEmptyOpticalRangeEntry,
	expandOpticalRanges,
	getOpticalRangePreview,
	toContinuousSphereValues,
	toInverseDuplicateSphereValues,
	validateOpticalRangeEntry
} from './opticalRangeForm';

function lensRange(
	overrides: Partial<LensOpticalRange> & Pick<LensOpticalRange, 'id'>
): LensOpticalRange {
	return {
		id: overrides.id,
		lensCatalogItemId: overrides.lensCatalogItemId ?? 'lens-1',
		sphereMin: overrides.sphereMin ?? 0,
		sphereMax: overrides.sphereMax ?? 0,
		cylinderMin: overrides.cylinderMin ?? null,
		cylinderMax: overrides.cylinderMax ?? null,
		additionMin: overrides.additionMin ?? null,
		additionMax: overrides.additionMax ?? null,
		createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
		updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z'
	};
}

describe('expandOpticalRanges', () => {
	it('keeps a continuous sphere range as a single saved range', () => {
		const entry = createEmptyOpticalRangeEntry();
		entry.sphereMin = '-4.00';
		entry.sphereMax = '4.00';
		entry.cylinderMin = '0.00';
		entry.cylinderMax = '-2.00';

		expect(expandOpticalRanges([entry])).toEqual([
			{
				sphereMin: -4,
				sphereMax: 4,
				cylinderMin: -2,
				cylinderMax: 0
			}
		]);
	});

	it('expands an inverse duplicate sphere range into two saved ranges', () => {
		const entry = createEmptyOpticalRangeEntry();
		entry.sphereMode = SPHERE_RANGE_MODE.INVERSE_DUPLICATE;
		entry.inverseOuter = '4.00';
		entry.inverseInner = '2.00';
		entry.cylinderMin = '0.00';
		entry.cylinderMax = '-2.00';

		expect(expandOpticalRanges([entry])).toEqual([
			{
				sphereMin: -4,
				sphereMax: -2,
				cylinderMin: -2,
				cylinderMax: 0
			},
			{
				sphereMin: 2,
				sphereMax: 4,
				cylinderMin: -2,
				cylinderMax: 0
			}
		]);
	});
});

describe('collapseOpticalRangesForForm', () => {
	it('merges mirrored sphere ranges back into a single inverse duplicate entry', () => {
		const collapsed = collapseOpticalRangesForForm([
			lensRange({
				id: 'negative',
				sphereMin: -4,
				sphereMax: -2,
				cylinderMin: -2,
				cylinderMax: 0
			}),
			lensRange({
				id: 'positive',
				sphereMin: 2,
				sphereMax: 4,
				cylinderMin: -2,
				cylinderMax: 0
			})
		]);

		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]).toMatchObject({
			sphereMode: SPHERE_RANGE_MODE.INVERSE_DUPLICATE,
			inverseOuter: '4.00',
			inverseInner: '2.00',
			cylinderMin: '-2.00',
			cylinderMax: '0.00'
		});
	});

	it('turns mirrored ranges with inner zero back into a continuous entry', () => {
		const collapsed = collapseOpticalRangesForForm([
			lensRange({ id: 'negative', sphereMin: -4, sphereMax: 0 }),
			lensRange({ id: 'positive', sphereMin: 0, sphereMax: 4 })
		]);

		expect(collapsed).toHaveLength(1);
		expect(collapsed[0]).toMatchObject({
			sphereMode: SPHERE_RANGE_MODE.CONTINUOUS,
			sphereMin: '-4.00',
			sphereMax: '4.00'
		});
	});
});

describe('range helpers', () => {
	it('creates an empty validation object with no errors', () => {
		expect(createEmptyOpticalRangeValidation()).toEqual({
			sphere: [],
			cylinder: [],
			addition: []
		});
	});

	it('builds a preview that explains the two stored mirrored ranges', () => {
		const entry = createEmptyOpticalRangeEntry();
		entry.sphereMode = SPHERE_RANGE_MODE.INVERSE_DUPLICATE;
		entry.inverseOuter = '4.00';
		entry.inverseInner = '2.00';
		entry.cylinderMin = '0.00';
		entry.cylinderMax = '-2.00';

		expect(getOpticalRangePreview(entry)).toEqual([
			'ESF -4.00 a -2.00 · CIL +0.00 a -2.00',
			'ESF +2.00 a +4.00 · CIL +0.00 a -2.00'
		]);
	});

	it('converts across-zero continuous ranges into inverse duplicate defaults with inner zero', () => {
		expect(toInverseDuplicateSphereValues('-4.00', '4.00')).toEqual({
			inverseOuter: '4.00',
			inverseInner: '0.00'
		});
		expect(toContinuousSphereValues('4.00')).toEqual({
			sphereMin: '-4.00',
			sphereMax: '4.00'
		});
	});

	it('flags invalid cylinder and addition signs before submit', () => {
		const entry = createEmptyOpticalRangeEntry();
		entry.cylinderMin = '-3.00';
		entry.cylinderMax = '0.25';
		entry.additionMin = '-0.25';
		entry.additionMax = '3.00';

		const validation = validateOpticalRangeEntry(entry);

		expect(validation.cylinder).toContain('Cilindro debe ser negativo o cero');
		expect(validation.addition).toContain('Adición debe ser mayor o igual a 0');
		expect(hasOpticalRangeValidationErrors(validation)).toBe(true);
	});

	it('allows reversed negative cylinder inputs because saved bounds are normalized', () => {
		const entry = createEmptyOpticalRangeEntry();
		entry.cylinderMin = '0.00';
		entry.cylinderMax = '-3.00';

		expect(validateOpticalRangeEntry(entry).cylinder).toEqual([]);
	});
});
