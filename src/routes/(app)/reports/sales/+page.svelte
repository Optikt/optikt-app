<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { ReportHeader, DateRangeFilter } from '$lib/components/reports';
	import { SaleStatusBadge } from '$lib/components/ui';
	import { formatPrice, formatDateOnly, downloadCsv, getErrorMessage } from '$lib/utils';
	import { monthStart, nowUTC, toISODate } from '$lib/dates';
	import { fetchSalesReport } from '$lib/remote/reports.remote';
	import { SALE_STATUS_LABELS } from '$lib/shared/enums';
	import type { ReportSale, SalesReportSummary } from '$lib/server/db/queries/reports';

	type StatusFilter = 'active' | 'cancelled' | 'all';

	let { data } = $props();
	let { sales: initialSales, summary: initialSummary } = untrack(() => data);

	let sales = $state<ReportSale[]>(initialSales);
	let summary = $state<SalesReportSummary>(initialSummary);
	let loading = $state(false);
	let statusFilter = $state<StatusFilter>('active');

	// Date range state - default to current month
	let dateFrom = $state(toISODate(monthStart()));
	let dateTo = $state(toISODate(nowUTC()));

	const filteredSales = $derived(
		statusFilter === 'all'
			? sales
			: statusFilter === 'cancelled'
				? sales.filter((s) => s.status === 'CANCELLED')
				: sales.filter((s) => s.status !== 'CANCELLED')
	);

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
		const rows = filteredSales.map((s) => [
			String(s.orderNumber),
			formatDateOnly(s.saleDate, { dateStyle: 'short' }),
			s.customerName ?? '-',
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
	<div class="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Ventas Activas</p>
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
		{#if summary.cancelledCount > 0}
			<div class="glass-card border-red-100 bg-red-50/50 p-4">
				<p class="text-sm text-red-400">Canceladas</p>
				<p class="text-2xl font-bold text-red-500">{summary.cancelledCount}</p>
				<p class="text-xs text-red-400">{formatPrice(summary.cancelledAmount)} anulado</p>
			</div>
		{/if}
	</div>

	<!-- Status filter + table -->
	<div class="glass-card overflow-hidden">
		<div class="flex items-center gap-3 border-b border-slate-200 px-4 py-3 print:hidden">
			<label for="statusFilter" class="text-sm font-medium text-slate-600">Mostrar:</label>
			<select
				id="statusFilter"
				bind:value={statusFilter}
				class="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-blue-500"
			>
				<option value="active">Activas (Pendientes + Completadas)</option>
				<option value="cancelled">Canceladas</option>
				<option value="all">Todas</option>
			</select>
			<span class="text-xs text-slate-400"
				>{filteredSales.length} resultado{filteredSales.length !== 1 ? 's' : ''}</span
			>
		</div>
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
				{#each filteredSales as sale (sale.id)}
					<tr
						class="cursor-pointer hover:bg-slate-50"
						class:opacity-50={sale.status === 'CANCELLED'}
						onclick={() => goto(resolve(`/sales/${sale.id}`))}
					>
						<td class="px-4 py-3 font-mono text-xs text-slate-400">#{sale.orderNumber}</td>
						<td class="px-4 py-3">{formatDateOnly(sale.saleDate, { dateStyle: 'medium' })}</td>
						<td class="px-4 py-3">{sale.customerName ?? '-'}</td>
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
