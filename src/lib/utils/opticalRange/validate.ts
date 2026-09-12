/**
 * Optical range entry validation.
 * Split from utils/opticalRangeForm.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import {
	parseOptionalNumber,
	pushUniqueError,
	validateAdditionValue,
	validateCylinderValue,
	validateSphereValue
} from './parse';
import { SPHERE_RANGE_MODE } from './types';
import type { OpticalRangeFormEntry, OpticalRangeValidation } from './types';
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

export type ValidateOpticalRangeOptions = {
	requireAddition?: boolean;
	skipAddition?: boolean;
};

export function validateOpticalRangeEntry(
	entry: OpticalRangeFormEntry,
	options: ValidateOpticalRangeOptions = {}
): OpticalRangeValidation {
	const validation = createEmptyOpticalRangeValidation();

	if (entry.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE) {
		const inverseOuter = parseOptionalNumber(entry.inverseOuter);
		const inverseInner = parseOptionalNumber(entry.inverseInner);

		if (inverseOuter === undefined) {
			pushUniqueError(validation.sphere, 'Ingresa el límite exterior de esfera');
		}

		if (inverseInner === undefined) {
			pushUniqueError(validation.sphere, 'Ingresa el límite interior de esfera');
		}

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

		if (sphereMin === undefined) {
			pushUniqueError(validation.sphere, 'Ingresa el valor mínimo de esfera');
		}

		if (sphereMax === undefined) {
			pushUniqueError(validation.sphere, 'Ingresa el valor máximo de esfera');
		}

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

	if (cylinderMin === undefined) {
		pushUniqueError(validation.cylinder, 'Ingresa el valor mínimo de cilindro');
	}

	if (cylinderMax === undefined) {
		pushUniqueError(validation.cylinder, 'Ingresa el valor máximo de cilindro');
	}

	if (cylinderMin !== undefined) {
		validateCylinderValue(cylinderMin, validation.cylinder);
	}

	if (cylinderMax !== undefined) {
		validateCylinderValue(cylinderMax, validation.cylinder);
	}

	if (
		cylinderMin !== undefined &&
		cylinderMax !== undefined &&
		(cylinderMin === 0) !== (cylinderMax === 0)
	) {
		pushUniqueError(validation.cylinder, 'Si un extremo de cilindro es 0, ambos deben ser 0');
	}

	const additionMin = parseOptionalNumber(entry.additionMin);
	const additionMax = parseOptionalNumber(entry.additionMax);

	if (!options.skipAddition) {
		if (additionMin === undefined) {
			pushUniqueError(validation.addition, 'Ingresa el valor mínimo de adición');
		}

		if (additionMax === undefined) {
			pushUniqueError(validation.addition, 'Ingresa el valor máximo de adición');
		}

		if (options.requireAddition) {
			const bothEmpty = additionMin === undefined && additionMax === undefined;
			const bothZero = additionMin === 0 && additionMax === 0;

			if (bothEmpty || bothZero) {
				pushUniqueError(
					validation.addition,
					'Los lentes bifocales, progresivos u ocupacionales requieren adición distinta de 0'
				);
			}
		}

		if (additionMin !== undefined) {
			validateAdditionValue(additionMin, validation.addition);
		}

		if (additionMax !== undefined) {
			validateAdditionValue(additionMax, validation.addition);
		}

		if (
			additionMin !== undefined &&
			additionMax !== undefined &&
			(additionMin === 0) !== (additionMax === 0)
		) {
			pushUniqueError(
				validation.addition,
				'Debe ingresar un rango de adición valido, no puede ser 0'
			);
		}
	}

	// All-zero range is meaningless
	const sphereValues =
		entry.sphereMode === SPHERE_RANGE_MODE.INVERSE_DUPLICATE
			? [parseOptionalNumber(entry.inverseOuter), parseOptionalNumber(entry.inverseInner)]
			: [parseOptionalNumber(entry.sphereMin), parseOptionalNumber(entry.sphereMax)];

	const allValues = options.skipAddition
		? [...sphereValues, cylinderMin, cylinderMax]
		: [...sphereValues, cylinderMin, cylinderMax, additionMin, additionMax];

	if (allValues.every((v) => v === 0)) {
		pushUniqueError(validation.sphere, 'El rango no puede tener todos los valores en 0');
	}

	return validation;
}
