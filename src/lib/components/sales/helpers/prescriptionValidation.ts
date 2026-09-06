/**
 * Prescription validation helpers for the sale wizard.
 * Pure functions that validate Rx fields on lens pairs.
 */

import { LensType } from '$lib/shared/enums/lensTypes';

import type { SaleItemRow, LensPairEntry } from '../newSaleTypes';

export interface PrescriptionFieldErrors {
	odSphere?: string;
	odCylinder?: string;
	odAxis?: string;
	odAddition?: string;
	oiSphere?: string;
	oiCylinder?: string;
	oiAxis?: string;
	oiAddition?: string;
	odDp?: string;
	oiDp?: string;
	odNp?: string;
	oiNp?: string;
	odAltura?: string;
	oiAltura?: string;
	doctorName?: string;
}

/** Determine which eyes need Rx validation based on enabled lens items */
export function getRequiredEyes(items: SaleItemRow[]): { needsOd: boolean; needsOi: boolean } {
	let needsOd = false;
	let needsOi = false;
	for (const item of items) {
		if (item.kind === 'lens') {
			if (item.lensPair.od.enabled) needsOd = true;
			if (item.lensPair.oi.enabled) needsOi = true;
		}
	}
	return { needsOd, needsOi };
}

function validateNumericEyeFields(
	sphere: number | null,
	cylinder: number | null,
	axis: number | null,
	addition: number | null,
	requiresAddition: boolean
): Record<string, string> {
	const errs: Record<string, string> = {};
	if (sphere === null && cylinder === null) {
		errs.sphere = 'Esfera o cilindro requerido';
		errs.cylinder = 'Esfera o cilindro requerido';
	}
	if (cylinder !== null && cylinder > 0) {
		errs.cylinder = 'Cilindro debe ser negativo o cero';
	}
	if (cylinder !== null && cylinder !== 0 && axis === null) {
		errs.axis = 'Eje requerido con cilindro';
	}
	if (axis !== null && (axis < 0 || axis > 180 || !Number.isInteger(axis))) {
		errs.axis = 'Eje debe ser entero entre 0 y 180';
	}
	if (requiresAddition) {
		if (addition === null || addition === 0) {
			errs.addition = 'Adición requerida';
		}
	}
	return errs;
}

/**
 * Validate a single lens pair's prescription fields.
 * Returns empty object when valid.
 */
export function validateLensPair(pair: LensPairEntry): PrescriptionFieldErrors {
	const errors: PrescriptionFieldErrors = {};
	const requiresAddition = pair.lensType !== LensType.MONOFOCAL;
	const needsPrescription = pair.od.enabled || pair.oi.enabled;
	if (needsPrescription && (!pair.doctorName || pair.doctorName.trim() === '')) {
		errors.doctorName = 'Doctor es requerido';
	}
	if (pair.od.enabled) {
		const od = validateNumericEyeFields(
			pair.od.prescription.sphere,
			pair.od.prescription.cylinder,
			pair.od.prescription.axis,
			pair.od.prescription.addition,
			requiresAddition
		);
		if (od.sphere) errors.odSphere = od.sphere;
		if (od.cylinder) errors.odCylinder = od.cylinder;
		if (od.axis) errors.odAxis = od.axis;
		if (od.addition) errors.odAddition = od.addition;
		if (pair.od.dp != null) {
			if (!Number.isInteger(pair.od.dp)) {
				errors.odDp = 'DP debe ser número entero';
			} else if (pair.od.dp < 10 || pair.od.dp > 80) {
				errors.odDp = 'DP debe ser 10-80';
			}
		}
		if (pair.od.np != null) {
			if (!Number.isInteger(pair.od.np)) {
				errors.odNp = 'NP debe ser número entero';
			} else if (pair.od.np < 10 || pair.od.np > 80) {
				errors.odNp = 'NP debe ser 10-80';
			}
		}
		if (pair.od.altura != null) {
			if (!Number.isInteger(pair.od.altura)) {
				errors.odAltura = 'Altura debe ser número entero';
			} else if (pair.od.altura < 10 || pair.od.altura > 40) {
				errors.odAltura = 'Altura debe ser 10-40';
			}
		}
	}
	if (pair.oi.enabled) {
		const oi = validateNumericEyeFields(
			pair.oi.prescription.sphere,
			pair.oi.prescription.cylinder,
			pair.oi.prescription.axis,
			pair.oi.prescription.addition,
			requiresAddition
		);
		if (oi.sphere) errors.oiSphere = oi.sphere;
		if (oi.cylinder) errors.oiCylinder = oi.cylinder;
		if (oi.axis) errors.oiAxis = oi.axis;
		if (oi.addition) errors.oiAddition = oi.addition;
		if (pair.oi.dp != null) {
			if (!Number.isInteger(pair.oi.dp)) {
				errors.oiDp = 'DP debe ser número entero';
			} else if (pair.oi.dp < 10 || pair.oi.dp > 80) {
				errors.oiDp = 'DP debe ser 10-80';
			}
		}
		if (pair.oi.np != null) {
			if (!Number.isInteger(pair.oi.np)) {
				errors.oiNp = 'NP debe ser número entero';
			} else if (pair.oi.np < 10 || pair.oi.np > 80) {
				errors.oiNp = 'NP debe ser 10-80';
			}
		}
		if (pair.oi.altura != null) {
			if (!Number.isInteger(pair.oi.altura)) {
				errors.oiAltura = 'Altura debe ser número entero';
			} else if (pair.oi.altura < 10 || pair.oi.altura > 40) {
				errors.oiAltura = 'Altura debe ser 10-40';
			}
		}
	}
	return errors;
}

/** Validate a single lens item's prescription fields. Returns empty object when valid. */
export function validateLensPrescription(item: SaleItemRow): PrescriptionFieldErrors {
	if (item.kind !== 'lens') return {};
	return validateLensPair(item.lensPair);
}

export function hasLensPrescriptionErrors(item: SaleItemRow): boolean {
	if (item.kind !== 'lens') return false;
	return Object.keys(validateLensPrescription(item)).length > 0;
}

function validateEyeFields(
	sphere: string,
	cylinder: string,
	axis: string,
	addition: string,
	requiresAddition: boolean
): Record<string, string> {
	const errs: Record<string, string> = {};

	if (sphere === '' && cylinder === '') {
		errs.sphere = 'Esfera o cilindro requerido';
		errs.cylinder = 'Esfera o cilindro requerido';
	}

	const cyl = parseFloat(cylinder);
	if (!isNaN(cyl) && cyl !== 0 && axis === '') {
		errs.axis = 'Eje requerido con cilindro';
	}

	if (requiresAddition) {
		const add = parseFloat(addition);
		if (addition === '' || isNaN(add) || add === 0) {
			errs.addition = 'Adición requerida';
		}
	}

	return errs;
}

/** Validate prescription fields. Returns empty object when all valid. */
export function validatePrescriptionFields(
	values: {
		odSphere: string;
		odCylinder: string;
		odAxis: string;
		odAddition: string;
		oiSphere: string;
		oiCylinder: string;
		oiAxis: string;
		oiAddition: string;
		lensType: string;
		doctorName: string;
	},
	needsOd: boolean,
	needsOi: boolean
): PrescriptionFieldErrors {
	const errors: PrescriptionFieldErrors = {};
	const requiresAddition = values.lensType !== LensType.MONOFOCAL;
	const needsPrescription = needsOd || needsOi;

	if (needsPrescription && (!values.doctorName || values.doctorName.trim() === '')) {
		errors.doctorName = 'Doctor es requerido';
	}

	if (needsOd) {
		const od = validateEyeFields(
			values.odSphere,
			values.odCylinder,
			values.odAxis,
			values.odAddition,
			requiresAddition
		);
		if (od.sphere) errors.odSphere = od.sphere;
		if (od.cylinder) errors.odCylinder = od.cylinder;
		if (od.axis) errors.odAxis = od.axis;
		if (od.addition) errors.odAddition = od.addition;
	}

	if (needsOi) {
		const oi = validateEyeFields(
			values.oiSphere,
			values.oiCylinder,
			values.oiAxis,
			values.oiAddition,
			requiresAddition
		);
		if (oi.sphere) errors.oiSphere = oi.sphere;
		if (oi.cylinder) errors.oiCylinder = oi.cylinder;
		if (oi.axis) errors.oiAxis = oi.axis;
		if (oi.addition) errors.oiAddition = oi.addition;
	}

	return errors;
}

export function hasPrescriptionErrors(errors: PrescriptionFieldErrors): boolean {
	return Object.keys(errors).length > 0;
}
