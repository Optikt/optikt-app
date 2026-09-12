import { describe, expect, it } from 'vitest';
import type { ExpenseListRow } from '$lib/server/db/queries/cash';
import {
	buildExpenseCsvRows,
	emptyExpenseForm,
	EXPENSE_CSV_HEADERS,
	validateVoidReason
} from './expenseForm';

describe('emptyExpenseForm', () => {
	it('returns blank defaults with today', () => {
		const form = emptyExpenseForm();

		expect(form).toMatchObject({
			category: 'OTHER',
			description: '',
			currency: 'USD',
			rateType: 'BCV'
		});
		expect(form.expenseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe('validateVoidReason', () => {
	it('rejects short reasons, allows cancel', () => {
		expect(validateVoidReason(null)).toBeNull();
		expect(validateVoidReason('abc')).toBe('Motivo mínimo 5 caracteres');
		expect(validateVoidReason('  abcde  ')).toBeNull();
	});
});

describe('buildExpenseCsvRows', () => {
	it('maps rows with labels and status', () => {
		const rows = buildExpenseCsvRows([
			{
				expenseDate: '2026-09-01',
				category: 'OTHER',
				description: 'Luz',
				currency: 'USD',
				amount: 10,
				amountUsd: 10,
				exchangeRate: null,
				bcvRate: 200,
				registeredByName: 'Ana',
				reference: 'F-1',
				voidedAt: null
			} as unknown as ExpenseListRow
		]);

		expect(rows[0]).toEqual([
			expect.any(String),
			'Otro',
			'Luz',
			'USD',
			'10.00',
			'10.00',
			'',
			'200.0000',
			'Ana',
			'F-1',
			'Activo'
		]);
		expect(EXPENSE_CSV_HEADERS.length).toBe(11);
	});
});
