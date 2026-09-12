import type { DailyBreakdownRow } from '$lib/server/db/queries/cash';

export function formatPct(value: number): string {
	return `${value.toFixed(1)}%`;
}

export const CASH_CSV_HEADERS = [
	'Fecha',
	'Ventas',
	'Ingresos',
	'Otros ingresos',
	'Desc. compras',
	'Var. cambiaria',
	'Cobrado',
	'Costo',
	'Utilidad Bruta',
	'Egresos',
	'Utilidad Neta'
];

export function buildCashCsvRows(daily: DailyBreakdownRow[]): string[][] {
	return daily.map((d) => [
		d.date,
		String(d.salesCount),
		d.revenue.toFixed(2),
		d.otherIncome.toFixed(2),
		d.purchaseDiscountsEarned.toFixed(2),
		d.exchangeSettlementVariance.toFixed(2),
		d.collected.toFixed(2),
		d.cogs.toFixed(2),
		d.grossProfit.toFixed(2),
		d.expenses.toFixed(2),
		d.netProfit.toFixed(2)
	]);
}
