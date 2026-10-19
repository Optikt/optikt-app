import { describe, expect, it } from 'vitest';

import { DiscountType } from '$lib/shared/enums';

import {
	createEmptyLensEditorDraft,
	evaluateLensEditorRange,
	hasLensEditorErrors,
	treatmentTotal,
	validateLensEditorDraft
} from './lensEditor';
import type { LensEditorDraft } from './types';
import type { OpticalRangeBounds } from './opticalRange';

function draft(overrides: Partial<LensEditorDraft> = {}): LensEditorDraft {
	return {
		...createEmptyLensEditorDraft(),
		lensCatalogItemId: 'lens-1',
		unitPrice: 50,
		...overrides
	};
}

const range: OpticalRangeBounds = {
	sphereMin: -2,
	sphereMax: 2,
	cylinderMin: -2,
	cylinderMax: 0,
	additionMin: null,
	additionMax: null
};

describe('validateLensEditorDraft', () => {
	it('accepts a valid monofocal lens', () => {
		const errors = validateLensEditorDraft(
			draft({ od: { sphere: -1, cylinder: -0.5, axis: 90, addition: null, altura: null } })
		);
		expect(hasLensEditorErrors(errors)).toBe(false);
	});

	it('requires a lens selection', () => {
		const errors = validateLensEditorDraft(draft({ lensCatalogItemId: '' }));
		expect(errors.lensCatalogItemId).toBe('Seleccione un cristal');
	});

	it('requires a positive price', () => {
		const errors = validateLensEditorDraft(draft({ unitPrice: 0 }));
		expect(errors.unitPrice).toBe('El precio debe ser mayor a 0');
	});

	it('rejects a positive cylinder (negative convention)', () => {
		const errors = validateLensEditorDraft(
			draft({ od: { sphere: -1, cylinder: 0.5, axis: 90, addition: null, altura: null } })
		);
		expect(errors.odCylinder).toBe('Cilindro debe ser negativo o cero');
	});

	it('rejects an out-of-bounds axis', () => {
		const errors = validateLensEditorDraft(
			draft({ od: { sphere: -1, cylinder: -0.5, axis: 200, addition: null, altura: null } })
		);
		expect(errors.odAxis).toBeDefined();
	});

	it('keeps discount non-negative', () => {
		const errors = validateLensEditorDraft(
			draft({ discount: -1, discountType: DiscountType.FIXED })
		);
		expect(errors.discount).toBe('El descuento no puede ser negativo');
	});

	it('does not block a prescription that is outside the lens range', () => {
		const outOfRange = draft({
			od: { sphere: 4, cylinder: -0.5, axis: 90, addition: null, altura: null }
		});

		expect(hasLensEditorErrors(validateLensEditorDraft(outOfRange))).toBe(false);
		expect(evaluateLensEditorRange(outOfRange, [range]).warnings.length).toBeGreaterThan(0);
	});
});

describe('evaluateLensEditorRange', () => {
	it('flags an eye outside the lens range as a warning', () => {
		const evaluation = evaluateLensEditorRange(
			draft({ od: { sphere: 3.5, cylinder: null, axis: null, addition: null, altura: null } }),
			[range]
		);
		expect(evaluation.warnings).toHaveLength(1);
		expect(evaluation.eyes[0]?.status).toBe('out-of-range');
	});

	it('does not warn when there are no ranges', () => {
		const evaluation = evaluateLensEditorRange(draft(), []);
		expect(evaluation.warnings).toHaveLength(0);
		expect(evaluation.hasRanges).toBe(false);
	});
});

describe('treatmentTotal', () => {
	it('sums both-eye treatment prices', () => {
		expect(
			treatmentTotal([
				{
					supplierTreatmentId: 't1',
					name: 'AR',
					price: 5,
					salePrice: 10,
					isTaxable: true,
					category: 'COAT'
				}
			])
		).toBe(20);
	});
});
