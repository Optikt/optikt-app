<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { ReportHeader, DateRangeFilter } from '$lib/components/reports';
	import { SaleStatusBadge } from '$lib/components/ui';
	import {
		formatPrice,
		formatDate,
		dateToISODateString,
		downloadCsv,
		getErrorMessage
	} from '$lib/utils';
	import { fetchSalesReport } from '$lib/remote/reports.remote';
	import { SALE_STATUS_LABELS } from '$lib/shared/enums';
	import type { ReportSale, SalesReportSummary } from '$lib/server/db/queries/reports';

	let { data } = $props();
	let { sales: initialSales, summary: initialSummary } = untrack(() => data);

	let sales = $state<ReportSale[]>(initialSales);
	let summary = $state<SalesReportSummary>(initialSummary);
	let loading = $state(false);

	// Date range state — default to current month
	const now = new Date();
	let dateFrom = $state(dateToISODateString(new Date(now.getFullYear(), now.getMonth(), 1)));
	let dateTo = $state(dateToISODateString(now));

	async function applyFilter() {
		loading = true;
		try {
			const result = await fetchSalesReport({ dateFrom, dateTo });
			sales = result.sales;
			summary = result.summary;
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando reporte de ventas'));
		} finally {
			loading = false;
		}
	}

	function handleExportCsv() {
		const headers = ['Nº Orden', 'Fecha', 'Cliente', 'Estado', 'Total', 'Pagado'];
		const rows = sales.map((s) => [
			String(s.orderNumber),
			formatDate(s.saleDate, { dateStyle: 'short' }),
			s.customerName ?? '—',
			SALE_STATUS_LABELS[s.status as keyof typeof SALE_STATUS_LABELS] ?? s.status,
			s.total.toFixed(2),
			s.paidAmountBcvUsd.toFixed(2)
		]);
		downloadCsv(`ventas-${dateFrom}-a-${dateTo}.csv`, headers, rows);
	}

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Reporte de Ventas - Optikt</title>
</svelte:head>

<div class="p-8">
	<ReportHeader
		title="Ventas por Período"
		subtitle="Listado de ventas con totales"
		onExportCsv={handleExportCsv}
		onPrint={handlePrint}
	/>

	<DateRangeFilter bind:dateFrom bind:dateTo {loading} onApply={applyFilter} />

	<!-- Summary cards -->
	<div class="mb-6 grid gap-4 sm:grid-cols-3">
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Total Ventas</p>
			<p class="text-2xl font-bold text-slate-900">{summary.count}</p>
		</div>
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Monto Total</p>
			<p class="text-2xl font-bold text-slate-900">{formatPrice(summary.totalAmount)}</p>
		</div>
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Total Cobrado</p>
			<p class="text-2xl font-bold text-slate-900">{formatPrice(summary.totalPaid)}</p>
		</div>
	</div>

	<!-- Table -->
	<div class="glass-card overflow-hidden">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
				<tr>
					<th class="px-4 py-3">Nº Orden</th>
					<th class="px-4 py-3">Fecha</th>
					<th class="px-4 py-3">Cliente</th>
					<th class="px-4 py-3">Estado</th>
					<th class="px-4 py-3 text-right">Total</th>
					<th class="px-4 py-3 text-right">Pagado</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each sales as sale (sale.id)}
					<tr
						class="cursor-pointer hover:bg-slate-50"
						onclick={() => goto(resolve(`/sales/${sale.id}`))}
					>
						<td class="px-4 py-3 font-mono text-xs text-slate-400">#{sale.orderNumber}</td>
						<td class="px-4 py-3">{formatDate(sale.saleDate, { dateStyle: 'medium' })}</td>
						<td class="px-4 py-3">{sale.customerName ?? '—'}</td>
						<td class="px-4 py-3"><SaleStatusBadge status={sale.status} /></td>
						<td class="px-4 py-3 text-right font-mono">{formatPrice(sale.total)}</td>
						<td class="px-4 py-3 text-right font-mono">{formatPrice(sale.paidAmountBcvUsd)}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="px-4 py-8 text-center text-slate-400">
							No hay ventas en el período seleccionado
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
