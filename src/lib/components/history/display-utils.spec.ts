import { describe, expect, it } from 'vitest';

import { formatChangeValue, getFieldLabel } from './display-utils';

describe('formatChangeValue', () => {
	it('formats ISO datetimes with a space separator (Postgres timestamptz text)', () => {
		const formatted = formatChangeValue('2026-11-13 20:02:56+00');
		expect(formatted).not.toContain('20:02:56');
		expect(formatted).not.toContain('+00');
		expect(formatted).toMatch(/2026/);
	});

	it('keeps formatting strict-ISO datetimes', () => {
		expect(formatChangeValue('2026-11-07T12:00:00.000Z')).toMatch(/2026/);
	});

	it('returns unparseable strings as-is', () => {
		expect(formatChangeValue('not-a-date')).toBe('not-a-date');
		expect(formatChangeValue('2026-13-99T99:99:99Z')).toBe('2026-13-99T99:99:99Z');
	});

	it('formats booleans as Sí/No', () => {
		expect(formatChangeValue(true)).toBe('Sí');
		expect(formatChangeValue(false)).toBe('No');
	});
});

describe('getFieldLabel for sale_payment', () => {
	it('uses friendly Spanish labels (never raw column names)', () => {
		expect(getFieldLabel('sale_payment', 'paymentMethod')).toBe('Método de pago');
		expect(getFieldLabel('sale_payment', 'amount')).toBe('Monto');
		expect(getFieldLabel('sale_payment', 'exchangeRate')).toBe('Tasa del método');
		expect(getFieldLabel('sale_payment', 'rateType')).toBe('Tipo de tasa');
		expect(getFieldLabel('sale_payment', 'bcvRate')).toBe('Tasa BCV');
		expect(getFieldLabel('sale_payment', 'amountBcvUsd')).toBe('Equivalente en USD');
		expect(getFieldLabel('sale_payment', 'isCasheaPayment')).toBe('Pago Cashea');
		expect(getFieldLabel('sale_payment', 'paymentDate')).toBe('Fecha de pago');
		expect(getFieldLabel('sale_payment', 'reference')).toBe('Referencia');
		expect(getFieldLabel('sale_payment', 'voidReason')).toBe('Motivo de anulación');
		expect(getFieldLabel('sale_payment', 'createdById')).toBe('Registrado por');
		expect(getFieldLabel('sale_payment', 'voidedById')).toBe('Anulado por');
	});
});
