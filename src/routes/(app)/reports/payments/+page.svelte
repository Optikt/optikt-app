<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { ReportHeader, DateRangeFilter } from '$lib/components/reports';
	import {
		formatPrice,
		formatDate,
		dateToISODateString,
		downloadCsv,
		getErrorMessage
	} from '$lib/utils';
	import { fetchPaymentsReport } from '$lib/remote/reports.remote';
	import { getPaymentMethodLabel } from '$lib/shared/enums';
	import type { ReportPayment, PaymentsReportSummary } from '$lib/server/db/queries/reports';

	let { data } = $props();
	let { payments: initialPayments, summary: initialSummary } = untrack(() => data);

	let payments = $state<ReportPayment[]>(initialPayments);
	let summary = $state<PaymentsReportSummary>(initialSummary);
	let loading = $state(false);

	// Date range state — default to current month
	const now = new Date();
	let dateFrom = $state(dateToISODateString(new Date(now.getFullYear(), now.getMonth(), 1)));
	let dateTo = $state(dateToISODateString(now));

	async function applyFilter() {
		loading = true;
		try {
			const result = await fetchPaymentsReport({ dateFrom, dateTo });
			payments = result.payments;
			summary = result.summary;
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando reporte de pagos'));
		} finally {
			loading = false;
		}
	}

	function handleExportCsv() {
		const headers = [
			'Fecha',
			'Método',
			'Monto Original',
			'Tasa BCV',
			'Monto USD (BCV)',
			'Referencia',
			'Nº Venta',
			'Cliente'
		];
		const rows = payments.map((p) => [
			p.paymentDate ? formatDate(p.paymentDate, { dateStyle: 'short' }) : '—',
			getPaymentMethodLabel(p.paymentMethod),
			p.amount.toFixed(2),
			p.bcvRate.toFixed(2),
			p.amountBcvUsd.toFixed(2),
			p.reference ?? '',
			String(p.saleOrderNumber),
			p.customerName ?? '—'
		]);
		downloadCsv(`pagos-${dateFrom}-a-${dateTo}.csv`, headers, rows);
	}

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	<title>Reporte de Pagos - Optikt</title>
</svelte:head>

<div class="p-8">
	<ReportHeader
		title="Pagos Recibidos"
		subtitle="Pagos por período con desglose por método"
		onExportCsv={handleExportCsv}
		onPrint={handlePrint}
	/>

	<DateRangeFilter bind:dateFrom bind:dateTo {loading} onApply={applyFilter} />

	<!-- Summary -->
	<div class="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Total Pagos</p>
			<p class="text-2xl font-bold text-slate-900">{summary.countPayments}</p>
		</div>
		<div class="glass-card p-4">
			<p class="text-sm text-slate-500">Monto Total (USD BCV)</p>
			<p class="text-2xl font-bold text-slate-900">{formatPrice(summary.totalBcvUsd)}</p>
		</div>
		{#each summary.byMethod as { method, total, count } (method)}
			<div class="glass-card p-4">
				<p class="text-sm text-slate-500">{getPaymentMethodLabel(method)}</p>
				<p class="text-lg font-bold text-slate-900">{formatPrice(total)}</p>
				<p class="text-xs text-slate-400">{count} pago{count !== 1 ? 's' : ''}</p>
			</div>
		{/each}
	</div>

	<!-- Table -->
	<div class="glass-card overflow-hidden">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
				<tr>
					<th class="px-4 py-3">Fecha</th>
					<th class="px-4 py-3">Método</th>
					<th class="px-4 py-3 text-right">Monto</th>
					<th class="px-4 py-3 text-right">Tasa BCV</th>
					<th class="px-4 py-3 text-right">USD (BCV)</th>
					<th class="px-4 py-3">Referencia</th>
					<th class="px-4 py-3">Venta</th>
					<th class="px-4 py-3">Cliente</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each payments as payment (payment.id)}
					<tr
						class="cursor-pointer hover:bg-slate-50"
						onclick={() => goto(resolve(`/sales/${payment.saleId}`))}
					>
						<td class="px-4 py-3">
							{payment.paymentDate ? formatDate(payment.paymentDate, { dateStyle: 'medium' }) : '—'}
						</td>
						<td class="px-4 py-3">{getPaymentMethodLabel(payment.paymentMethod)}</td>
						<td class="px-4 py-3 text-right font-mono">{formatPrice(payment.amount)}</td>
						<td class="px-4 py-3 text-right font-mono">{payment.bcvRate.toFixed(2)}</td>
						<td class="px-4 py-3 text-right font-mono">{formatPrice(payment.amountBcvUsd)}</td>
						<td class="px-4 py-3 font-mono text-xs text-slate-400">
							{payment.reference ?? '—'}
						</td>
						<td class="px-4 py-3 font-mono text-xs text-slate-400">
							#{payment.saleOrderNumber}
						</td>
						<td class="px-4 py-3">{payment.customerName ?? '—'}</td>
					</tr>
				{:else}
					<tr>
						<td colspan="8" class="px-4 py-8 text-center text-slate-400">
							No hay pagos en el período seleccionado
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
