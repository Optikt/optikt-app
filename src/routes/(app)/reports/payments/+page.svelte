<script lang="ts">
	import { untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { ReportHeader, DateRangeFilter } from '$lib/components/reports';
	import {
		formatPrice,
		formatDate,
		formatDateOnly,
		downloadCsv,
		getErrorMessage
	} from '$lib/utils';
	import { monthStart, nowUTC, toISODate } from '$lib/dates';
	import { fetchPaymentsReport } from '$lib/remote/reports.remote';
	import { getPaymentMethodLabel } from '$lib/shared/enums';
	import type {
		ReportPayment,
		RefundEntry,
		PaymentsReportSummary
	} from '$lib/server/db/queries/reports';

	let { data } = $props();
	let {
		payments: initialPayments,
		refunds: initialRefunds,
		summary: initialSummary
	} = untrack(() => data);

	let payments = $state<ReportPayment[]>(initialPayments);
	let refunds = $state<RefundEntry[]>(initialRefunds);
	let summary = $state<PaymentsReportSummary>(initialSummary);
	let loading = $state(false);

	// Date range state - default to current month
	let dateFrom = $state(toISODate(monthStart()));
	let dateTo = $state(toISODate(nowUTC()));

	async function applyFilter() {
		loading = true;
		try {
			const result = await fetchPaymentsReport({ dateFrom, dateTo }).run();
			payments = result.payments;
			refunds = result.refunds;
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
			'Registrado',
			'Método',
			'Monto Original',
			'Tasa BCV',
			'Monto USD (BCV)',
			'Referencia',
			'Nº Venta',
			'Cliente'
		];
		const rows = payments.map((p) => [
			formatDateOnly(p.paymentDate, { dateStyle: 'short' }),
			formatDate(p.createdAt, { dateStyle: 'short', timeStyle: 'short' }),
			getPaymentMethodLabel(p.paymentMethod),
			p.amount.toFixed(2),
			p.bcvRate.toFixed(2),
			p.amountBcvUsd.toFixed(2),
			p.reference ?? '',
			String(p.saleOrderNumber),
			p.customerName ?? '-'
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
			<p class="text-sm text-slate-500">Ingresos (USD BCV)</p>
			<p class="text-2xl font-bold text-emerald-600">{formatPrice(summary.grossBcvUsd)}</p>
		</div>
		{#if summary.retainedBcvUsd > 0}
			<div class="glass-card border-amber-200 p-4">
				<p class="text-sm text-amber-500">Depósitos Retenidos</p>
				<p class="text-2xl font-bold text-amber-600">{formatPrice(summary.retainedBcvUsd)}</p>
			</div>
		{/if}
		{#if summary.refundCount > 0}
			<div class="glass-card border-slate-200 p-4">
				<p class="text-sm text-slate-500">Reembolsos Emitidos</p>
				<p class="text-2xl font-bold text-slate-700">{formatPrice(summary.refundedBcvUsd)}</p>
				<p class="text-xs text-slate-400">
					{summary.refundCount} venta{summary.refundCount !== 1 ? 's' : ''}
				</p>
			</div>
		{/if}
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
							<div>{formatDateOnly(payment.paymentDate, { dateStyle: 'medium' })}</div>
							<div class="text-xs text-slate-400">
								Reg. {formatDate(payment.createdAt, { hour: '2-digit', minute: '2-digit' })}
							</div>
						</td>
						<td class="px-4 py-3">
							{getPaymentMethodLabel(payment.paymentMethod)}
							{#if payment.isRetained}
								<span
									class="ml-1 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
									>Retenido</span
								>
							{/if}
						</td>
						<td class="px-4 py-3 text-right font-mono">{formatPrice(payment.amount)}</td>
						<td class="px-4 py-3 text-right font-mono">{payment.bcvRate.toFixed(2)}</td>
						<td class="px-4 py-3 text-right font-mono">{formatPrice(payment.amountBcvUsd)}</td>
						<td class="px-4 py-3 font-mono text-xs text-slate-400">
							{payment.reference ?? '-'}
						</td>
						<td class="px-4 py-3 font-mono text-xs text-slate-400">
							#{payment.saleOrderNumber}
						</td>
						<td class="px-4 py-3">{payment.customerName ?? '-'}</td>
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

	<!-- Refunds section -->
	{#if refunds.length > 0}
		<div class="mt-6">
			<h3 class="mb-3 text-lg font-semibold text-slate-900">Reembolsos Emitidos</h3>
			<div class="glass-card overflow-hidden">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-slate-200 bg-red-50 text-xs text-red-600 uppercase">
						<tr>
							<th class="px-4 py-3">Fecha</th>
							<th class="px-4 py-3">Venta</th>
							<th class="px-4 py-3">Cliente</th>
							<th class="px-4 py-3 text-right">Monto Reembolsado</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each refunds as refund (refund.saleId)}
							<tr
								class="cursor-pointer hover:bg-red-50/50"
								onclick={() => goto(resolve(`/sales/${refund.saleId}`))}
							>
								<td class="px-4 py-3">
									{refund.cancelledAt
										? formatDate(refund.cancelledAt, { dateStyle: 'medium' })
										: '-'}
								</td>
								<td class="px-4 py-3 font-mono text-xs text-slate-400">
									#{refund.saleOrderNumber}
								</td>
								<td class="px-4 py-3">{refund.customerName ?? '-'}</td>
								<td class="px-4 py-3 text-right font-mono font-bold text-red-600">
									-{formatPrice(refund.refundAmount)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>
