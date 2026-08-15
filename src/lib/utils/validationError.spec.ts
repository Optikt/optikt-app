import { describe, it, expect } from 'vitest';
import { buildValidationMessage } from './validationError';

describe('buildValidationMessage', () => {
	it('returns generic message for empty issues', () => {
		expect(buildValidationMessage([])).toBe('Datos inválidos');
	});

	it('maps known field labels and zod default messages to Spanish', () => {
		const issues = [
			{
				code: 'invalid_format',
				path: ['saleDate'],
				message: 'Invalid ISO date',
				format: 'iso_date'
			}
		];
		expect(buildValidationMessage(issues)).toBe('La fecha de venta no es una fecha válida');
	});

	it('passes through custom Spanish messages from refinements', () => {
		const issues = [
			{ code: 'custom', path: ['items'], message: 'Debe seleccionar o crear un cliente' }
		];
		expect(buildValidationMessage(issues)).toBe('Debe seleccionar o crear un cliente');
	});

	it('humanizes unknown camelCase fields', () => {
		const issues = [{ code: 'required', path: ['odAltura'], message: 'Required' }];
		expect(buildValidationMessage(issues)).toBe('Od altura es requerido');
	});

	it('handles numeric path segments and deep paths', () => {
		const issues = [{ code: 'too_big', path: ['items', 0, 'quantity'], message: 'Too big' }];
		expect(buildValidationMessage(issues)).toBe('La cantidad excede el máximo permitido');
	});

	it('uses generic phrase when no field path', () => {
		const issues = [{ code: 'invalid_type', message: 'Invalid input' }];
		expect(buildValidationMessage(issues)).toBe('El valor es inválido');
	});

	it('joins multiple issues respecting maxIssues', () => {
		const issues = [
			{ code: 'required', path: ['reason'], message: 'Required' },
			{
				code: 'invalid_format',
				path: ['saleDate'],
				message: 'Invalid ISO date',
				format: 'iso_date'
			}
		];
		expect(buildValidationMessage(issues)).toBe('El motivo es requerido');
		expect(buildValidationMessage(issues, { maxIssues: 2 })).toBe(
			'El motivo es requerido; La fecha de venta no es una fecha válida'
		);
	});

	it('deduplicates repeated issues', () => {
		const issues = [
			{ code: 'required', path: ['reason'], message: 'Required' },
			{ code: 'required', path: ['reason'], message: 'Required' }
		];
		expect(buildValidationMessage(issues)).toBe('El motivo es requerido');
	});

	it('maps enum and email formats', () => {
		expect(buildValidationMessage([{ code: 'invalid_enum_value', path: ['status'] }])).toBe(
			'El estado no es una opción válida'
		);
		expect(
			buildValidationMessage([
				{ code: 'invalid_format', path: ['email'], message: 'Invalid email', format: 'email' }
			])
		).toBe('El correo electrónico no es un correo electrónico válido');
	});
});
