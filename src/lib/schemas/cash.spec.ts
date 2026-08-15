import { describe, it, expect } from 'vitest';
import { CreateExpenseSchema, VoidExpenseSchema, CashReportFiltersSchema } from './cash';

const baseUsd = {
	category: 'RENT',
	description: 'Alquiler local',
	currency: 'USD',
	amount: 500,
	bcvRate: 36.5,
	expenseDate: '2025-05-15'
};

describe('CreateExpenseSchema', () => {
	it('accepts a USD expense without exchange rate', () => {
		const r = CreateExpenseSchema.safeParse(baseUsd);
		expect(r.success).toBe(true);
	});

	it('rejects VES expense without exchange rate', () => {
		const r = CreateExpenseSchema.safeParse({
			...baseUsd,
			currency: 'VES',
			amount: 1000
		});
		expect(r.success).toBe(false);
		const issues = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
		expect(issues).toContain('exchangeRate');
		expect(issues).toContain('rateType');
	});

	it('accepts VES expense with rate + rateType', () => {
		const r = CreateExpenseSchema.safeParse({
			...baseUsd,
			currency: 'VES',
			amount: 1000,
			exchangeRate: 36.5,
			rateType: 'BCV'
		});
		expect(r.success).toBe(true);
	});

	it('rejects EUR expense missing rate', () => {
		const r = CreateExpenseSchema.safeParse({
			...baseUsd,
			currency: 'EUR',
			amount: 100
		});
		expect(r.success).toBe(false);
	});

	it('rejects any expense missing BCV reference rate', () => {
		const { bcvRate: _bcvRate, ...withoutBcv } = baseUsd;
		const r = CreateExpenseSchema.safeParse(withoutBcv);
		expect(r.success).toBe(false);
		const issues = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
		expect(issues).toContain('bcvRate');
	});

	it('rejects USDT expense without its own operative rate', () => {
		const r = CreateExpenseSchema.safeParse({
			...baseUsd,
			currency: 'USDT',
			category: 'PUBLICITY',
			amount: 75
		});
		expect(r.success).toBe(false);
		const issues = r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
		expect(issues).toContain('exchangeRate');
		expect(issues).not.toContain('rateType');
	});

	it('accepts USDT expense with BCV reference and USDT rate', () => {
		const r = CreateExpenseSchema.safeParse({
			...baseUsd,
			currency: 'USDT',
			category: 'PUBLICITY',
			amount: 75,
			exchangeRate: 40.25
		});
		expect(r.success).toBe(true);
	});

	it('rejects amount <= 0', () => {
		const r = CreateExpenseSchema.safeParse({ ...baseUsd, amount: 0 });
		expect(r.success).toBe(false);
	});

	it('rejects description shorter than 3 chars', () => {
		const r = CreateExpenseSchema.safeParse({ ...baseUsd, description: 'AB' });
		expect(r.success).toBe(false);
	});
});

describe('VoidExpenseSchema', () => {
	it('rejects motivo demasiado corto', () => {
		const r = VoidExpenseSchema.safeParse({
			id: '00000000-0000-0000-0000-000000000000',
			voidReason: 'no'
		});
		expect(r.success).toBe(false);
	});

	it('accepts motivo válido', () => {
		const r = VoidExpenseSchema.safeParse({
			id: '00000000-0000-0000-0000-000000000000',
			voidReason: 'duplicado del recibo'
		});
		expect(r.success).toBe(true);
	});
});

describe('CashReportFiltersSchema', () => {
	it('rejects to < from', () => {
		const r = CashReportFiltersSchema.safeParse({
			from: '2025-05-15',
			to: '2025-05-01'
		});
		expect(r.success).toBe(false);
	});

	it('accepts to == from', () => {
		const r = CashReportFiltersSchema.safeParse({
			from: '2025-05-15',
			to: '2025-05-15'
		});
		expect(r.success).toBe(true);
	});
});
