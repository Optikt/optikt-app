import { describe, expect, it } from 'vitest';
import type { DailyBreakdownRow } from '$lib/server/db/queries/cash';
import { buildCashCsvRows, CASH_CSV_HEADERS, formatPct } from './cashReport';

describe('formatPct', () => {
	it('formats one decimal with sign', () => {
		expect(formatPct(12.345)).toBe('12.3%');
		expect(formatPct(0)).toBe('0.0%');
	});
});

describe('buildCashCsvRows', () => {
	it('maps daily rows in header order', () => {
		const rows = buildCashCsvRows([
			{
				date: '2026-09-01',
				salesCount: 2,
				revenue: 100,
				otherIncome: 5,
				purchaseDiscountsEarned: 1,
				exchangeSettlementVariance: 0.5,
				collected: 80,
				cogs: 40,
				grossProfit: 60,
				expenses: 10,
				netProfit: 50
			} as DailyBreakdownRow
		]);

		expect(rows).toEqual([
			[
				'2026-09-01',
				'2',
				'100.00',
				'5.00',
				'1.00',
				'0.50',
				'80.00',
				'40.00',
				'60.00',
				'10.00',
				'50.00'
			]
		]);
		expect(CASH_CSV_HEADERS.length).toBe(11);
	});
});
