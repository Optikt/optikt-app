import { describe, it, expect } from 'vitest';
import {
	validatePrescriptionFields,
	hasPrescriptionErrors,
	getRequiredEyes
} from './saleItemHelpers';
import { DiscountType } from '$lib/shared/enums';
import type { SaleItemRow } from './newSaleTypes';
import { createEmptyLensPair } from './newSaleTypes';

function makeValues(overrides: Partial<Record<string, string>> = {}) {
	return {
		odSphere: '',
		odCylinder: '',
		odAxis: '',
		odAddition: '',
		oiSphere: '',
		oiCylinder: '',
		oiAxis: '',
		oiAddition: '',
		lensType: 'MONOFOCAL',
		...overrides
	};
}

function makeLensItem(odEnabled = true, oiEnabled = true): SaleItemRow {
	const pair = createEmptyLensPair();
	pair.catalogItemId = 'some-lens';
	pair.od.enabled = odEnabled;
	pair.oi.enabled = oiEnabled;
	return {
		id: 'item-1',
		kind: 'lens',
		productId: '',
		quantity: 1,
		lensPair: pair,
		treatments: [],
		unitPrice: 100,
		discount: 0,
		discountType: DiscountType.FIXED,
		notes: '',
		costOverrides: null,
		shippingCostPending: false
	};
}

describe('getRequiredEyes', () => {
	it('returns false for both when no lens items', () => {
		const result = getRequiredEyes([]);
		expect(result).toEqual({ needsOd: false, needsOi: false });
	});

	it('detects enabled OD only', () => {
		const result = getRequiredEyes([makeLensItem(true, false)]);
		expect(result).toEqual({ needsOd: true, needsOi: false });
	});

	it('detects both eyes enabled', () => {
		const result = getRequiredEyes([makeLensItem(true, true)]);
		expect(result).toEqual({ needsOd: true, needsOi: true });
	});
});

describe('validatePrescriptionFields', () => {
	it('returns no errors when no eyes needed', () => {
		const errors = validatePrescriptionFields(makeValues(), false, false);
		expect(hasPrescriptionErrors(errors)).toBe(false);
	});

	it('requires sphere or cylinder for OD', () => {
		const errors = validatePrescriptionFields(makeValues(), true, false);
		expect(errors.odSphere).toBeDefined();
		expect(errors.odCylinder).toBeDefined();
		expect(errors.oiSphere).toBeUndefined();
	});

	it('accepts sphere alone for OD (value 0 is valid)', () => {
		const errors = validatePrescriptionFields(makeValues({ odSphere: '0' }), true, false);
		expect(errors.odSphere).toBeUndefined();
		expect(errors.odCylinder).toBeUndefined();
	});

	it('accepts cylinder alone for OD', () => {
		const errors = validatePrescriptionFields(
			makeValues({ odCylinder: '-1.50', odAxis: '90' }),
			true,
			false
		);
		expect(errors.odSphere).toBeUndefined();
		expect(errors.odCylinder).toBeUndefined();
	});

	it('requires axis when cylinder is non-zero', () => {
		const errors = validatePrescriptionFields(
			makeValues({ odSphere: '-2.00', odCylinder: '-0.50' }),
			true,
			false
		);
		expect(errors.odAxis).toBeDefined();
	});

	it('does not require axis when cylinder is 0', () => {
		const errors = validatePrescriptionFields(
			makeValues({ odSphere: '-2.00', odCylinder: '0' }),
			true,
			false
		);
		expect(errors.odAxis).toBeUndefined();
	});

	it('does not require axis when cylinder is empty', () => {
		const errors = validatePrescriptionFields(makeValues({ odSphere: '-2.00' }), true, false);
		expect(errors.odAxis).toBeUndefined();
	});

	it('requires addition for progressive lenses', () => {
		const errors = validatePrescriptionFields(
			makeValues({ odSphere: '-2.00', lensType: 'PROGRESSIVE' }),
			true,
			false
		);
		expect(errors.odAddition).toBeDefined();
	});

	it('rejects addition of 0 for bifocal', () => {
		const errors = validatePrescriptionFields(
			makeValues({ odSphere: '-2.00', odAddition: '0', lensType: 'BIFOCAL' }),
			true,
			false
		);
		expect(errors.odAddition).toBeDefined();
	});

	it('accepts valid addition for progressive', () => {
		const errors = validatePrescriptionFields(
			makeValues({ odSphere: '-2.00', odAddition: '1.50', lensType: 'PROGRESSIVE' }),
			true,
			false
		);
		expect(errors.odAddition).toBeUndefined();
	});

	it('does not require addition for monofocal', () => {
		const errors = validatePrescriptionFields(
			makeValues({ odSphere: '-2.00', lensType: 'MONOFOCAL' }),
			true,
			false
		);
		expect(errors.odAddition).toBeUndefined();
	});

	it('validates OI independently', () => {
		const errors = validatePrescriptionFields(makeValues(), false, true);
		expect(errors.oiSphere).toBeDefined();
		expect(errors.oiCylinder).toBeDefined();
		expect(errors.odSphere).toBeUndefined();
	});

	it('validates both eyes simultaneously', () => {
		const errors = validatePrescriptionFields(
			makeValues({ odSphere: '-2.00' }), // OD valid, OI missing
			true,
			true
		);
		expect(errors.odSphere).toBeUndefined();
		expect(errors.oiSphere).toBeDefined();
		expect(errors.oiCylinder).toBeDefined();
	});

	it('validates occupational requires addition', () => {
		const errors = validatePrescriptionFields(
			makeValues({ oiSphere: '-1.00', lensType: 'OCCUPATIONAL' }),
			false,
			true
		);
		expect(errors.oiAddition).toBeDefined();
	});
});
