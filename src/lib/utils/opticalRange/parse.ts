/**
 * Optical range parsing primitives.
 * Split from utils/opticalRangeForm.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import type { OptionalBounds } from './types';
export function formatOptional(value: number | null | undefined): string {
	return value == null ? '' : value.toFixed(2);
}

export function parseNumber(value: string): number {
	return parseFloat(value) || 0;
}

export function parseOptionalBounds(minValue: string, maxValue: string): OptionalBounds {
	const min = minValue ? parseFloat(minValue) : undefined;
	const max = maxValue ? parseFloat(maxValue) : undefined;
	const hasMin = min !== undefined && !Number.isNaN(min);
	const hasMax = max !== undefined && !Number.isNaN(max);

	if (!hasMin || !hasMax) return {};

	// Both zero means "not set" - won't be saved
	if (min === 0 && max === 0) return {};

	return {
		min: Math.min(min!, max!),
		max: Math.max(min!, max!)
	};
}

export function parseOptionalNumber(value: string | number | null | undefined): number | undefined {
	if (value == null) return undefined;
	if (typeof value === 'number') return Number.isNaN(value) ? undefined : value;

	const trimmed = value.trim();
	if (!trimmed) return undefined;

	const parsed = Number(trimmed);
	return Number.isNaN(parsed) ? undefined : parsed;
}

export function isQuarterStep(value: number): boolean {
	return Math.abs(value * 4 - Math.round(value * 4)) < 1e-9;
}

export function pushUniqueError(errors: string[], message: string) {
	if (!errors.includes(message)) {
		errors.push(message);
	}
}

export function validateSphereValue(value: number, errors: string[]) {
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

export function validateCylinderValue(value: number, errors: string[]) {
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

export function validateAdditionValue(value: number, errors: string[]) {
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
