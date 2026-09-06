import { describe, expect, it } from 'vitest';

import { LensType } from '$lib/shared/enums/lensTypes';

import { createEmptyLensPair } from '../newSaleTypes';
import {
	hasPrescriptionErrors,
	validateLensPair,
	validateLensPrescription,
	validatePrescriptionFields
} from './prescriptionValidation';
import { makeConfirmationLensRow } from './testFixtures';

describe('validateLensPair', () => {
	it('accepts a valid monofocal prescription', () => {
		const pair = createEmptyLensPair();
		pair.lensType = LensType.MONOFOCAL;
		pair.doctorName = 'Dr. Prueba';
		pair.od.enabled = true;
		pair.od.prescription = { sphere: -1.5, cylinder: -0.5, axis: 90, addition: null };
		pair.oi.enabled = true;
		pair.oi.prescription = { sphere: -1.0, cylinder: 0, axis: null, addition: null };

		expect(validateLensPair(pair)).toEqual({});
	});

	it('requires doctor when a prescription is needed', () => {
		const pair = createEmptyLensPair();
		pair.lensType = LensType.MONOFOCAL;
		pair.od.enabled = true;

		expect(validateLensPair(pair).doctorName).toBe('Doctor es requerido');
	});

	it('rejects positive cylinder', () => {
		const pair = createEmptyLensPair();
		pair.lensType = LensType.MONOFOCAL;
		pair.doctorName = 'Dr. Prueba';
		pair.od.enabled = true;
		pair.od.prescription = { sphere: -1.0, cylinder: 0.5, axis: 90, addition: null };

		expect(validateLensPair(pair).odCylinder).toBe('Cilindro debe ser negativo o cero');
	});

	it('requires axis when cylinder is present', () => {
		const pair = createEmptyLensPair();
		pair.lensType = LensType.MONOFOCAL;
		pair.doctorName = 'Dr. Prueba';
		pair.od.enabled = true;
		pair.od.prescription = { sphere: -1.0, cylinder: -0.5, axis: null, addition: null };

		expect(validateLensPair(pair).odAxis).toBe('Eje requerido con cilindro');
	});

	it('requires addition for progressive lenses', () => {
		const pair = createEmptyLensPair();
		pair.lensType = LensType.PROGRESSIVE;
		pair.doctorName = 'Dr. Prueba';
		pair.od.enabled = true;
		pair.od.prescription = { sphere: 1.0, cylinder: -0.5, axis: 90, addition: null };

		expect(validateLensPair(pair).odAddition).toBe('Adición requerida');
	});

	it('validates dp/np/altura ranges', () => {
		const pair = createEmptyLensPair();
		pair.lensType = LensType.MONOFOCAL;
		pair.doctorName = 'Dr. Prueba';
		pair.od.enabled = true;
		pair.od.prescription = { sphere: -1.0, cylinder: 0, axis: null, addition: null };
		pair.od.dp = 5;
		pair.od.np = 90;
		pair.od.altura = 55;

		const errors = validateLensPair(pair);
		expect(errors.odDp).toBe('DP debe ser 10-80');
		expect(errors.odNp).toBe('NP debe ser 10-80');
		expect(errors.odAltura).toBe('Altura debe ser 10-40');
	});
});

describe('validateLensPrescription', () => {
	it('returns empty errors for non-lens items', () => {
		expect(validateLensPrescription(makeConfirmationLensRow())).toBeDefined();
	});

	it('returns no errors for a valid lens row with doctor', () => {
		const row = makeConfirmationLensRow();
		row.lensPair.doctorName = 'Dr. Prueba';
		row.lensPair.od.prescription = { sphere: -1.0, cylinder: 0, axis: null, addition: null };
		row.lensPair.oi.prescription = { sphere: -1.25, cylinder: 0, axis: null, addition: null };

		expect(hasPrescriptionErrors(validateLensPrescription(row))).toBe(false);
	});
});

describe('validatePrescriptionFields', () => {
	it('accepts valid string-based fields', () => {
		const errors = validatePrescriptionFields(
			{
				odSphere: '-1.50',
				odCylinder: '-0.50',
				odAxis: '90',
				odAddition: '',
				oiSphere: '-1.00',
				oiCylinder: '',
				oiAxis: '',
				oiAddition: '',
				lensType: LensType.MONOFOCAL,
				doctorName: 'Dr. Prueba'
			},
			true,
			true
		);

		expect(errors).toEqual({});
	});

	it('requires sphere or cylinder per eye', () => {
		const errors = validatePrescriptionFields(
			{
				odSphere: '',
				odCylinder: '',
				odAxis: '',
				odAddition: '',
				oiSphere: '',
				oiCylinder: '',
				oiAxis: '',
				oiAddition: '',
				lensType: LensType.MONOFOCAL,
				doctorName: 'Dr. Prueba'
			},
			true,
			true
		);

		expect(errors.odSphere).toBe('Esfera o cilindro requerido');
		expect(errors.oiSphere).toBe('Esfera o cilindro requerido');
	});

	it('requires axis when cylinder string is present', () => {
		const errors = validatePrescriptionFields(
			{
				odSphere: '-1.50',
				odCylinder: '-0.50',
				odAxis: '',
				odAddition: '',
				oiSphere: '',
				oiCylinder: '',
				oiAxis: '',
				oiAddition: '',
				lensType: LensType.MONOFOCAL,
				doctorName: 'Dr. Prueba'
			},
			true,
			false
		);

		expect(errors.odAxis).toBe('Eje requerido con cilindro');
	});

	it('requires addition for progressive lens types', () => {
		const errors = validatePrescriptionFields(
			{
				odSphere: '1.00',
				odCylinder: '',
				odAxis: '',
				odAddition: '',
				oiSphere: '',
				oiCylinder: '',
				oiAxis: '',
				oiAddition: '',
				lensType: LensType.PROGRESSIVE,
				doctorName: 'Dr. Prueba'
			},
			true,
			false
		);

		expect(errors.odAddition).toBe('Adición requerida');
	});

	it('requires doctor when prescription is needed', () => {
		const errors = validatePrescriptionFields(
			{
				odSphere: '-1.00',
				odCylinder: '',
				odAxis: '',
				odAddition: '',
				oiSphere: '',
				oiCylinder: '',
				oiAxis: '',
				oiAddition: '',
				lensType: LensType.MONOFOCAL,
				doctorName: ''
			},
			true,
			false
		);

		expect(errors.doctorName).toBe('Doctor es requerido');
	});
});
