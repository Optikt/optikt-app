<script lang="ts">
	import { untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { resolve } from '$app/paths';
	import { ReportHeader, DateRangeFilter } from '$lib/components/reports';
	import { formatPrice, formatDate, downloadCsv, getErrorMessage } from '$lib/utils';
	import { EXPENSE_CATEGORY_LABELS } from '$lib/shared/enums';
	import {
		getCashReportQuery,
		getDailyBreakdownQuery,
		getPipelineQuery
	} from '$lib/remote/cash.remote';
	import type {
		CashReport,
		DailyBreakdownRow,
		PipelineSnapshot
	} from '$lib/server/db/queries/cash';
	import {
		TrendingUp,
		Wallet,
		Receipt,
		TrendingDown,
		AlertTriangle,
		ListChecks,
		Package,
		PlusCircle
	} from '@lucide/svelte';

	let { data } = $props();
	const initial = untrack(() => data);

	let report = $state<CashReport>(initial.report);
	let daily = $state<DailyBreakdownRow[]>(initial.daily);
	let pipeline = $state<PipelineSnapshot>(initial.pipeline);
	let dateFrom = $state(initial.dateFrom);
	let dateTo = $state(initial.dateTo);
	let loading = $state(false);

	async function applyFilter() {
		loading = true;
		try {
			const [r, d, p] = await Promise.all([
				getCashReportQuery({ from: dateFrom, to: dateTo }).run(),
				getDailyBreakdownQuery({ from: dateFrom, to: dateTo }).run(),
				getPipelineQuery().run()
			]);
			report = r;
			daily = d;
			pipeline = p;
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando reporte de caja'));
		} finally {
			loading = false;
		}
	}

	function handleExportCsv() {
		const headers = [
			'Fecha',
			'Ventas',
			'Ingresos',
			'Otros ingresos',
			'Cobrado',
			'Costo',
			'Utilidad Bruta',
			'Egresos',
			'Utilidad Neta'
		];
		const rows = daily.map((d) => [
			d.date,
			String(d.salesCount),
			d.revenue.toFixed(2),
			d.otherIncome.toFixed(2),
			d.collected.toFixed(2),
			d.cogs.toFixed(2),
			d.grossProfit.toFixed(2),
			d.expenses.toFixed(2),
			d.netProfit.toFixed(2)
		]);
		downloadCsv(`caja-${dateFrom}-a-${dateTo}.csv`, headers, rows);
	}

	function handlePrint() {
		window.print();
	}

	const formatPct = (v: number) => `${v.toFixed(1)}%`;
</script>

<svelte:head>
	<title>Caja & P&L - Optikt</title>
</svelte:head>

<div class="px-3 py-3 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
	<ReportHeader title="Caja & P&amp;L" onExportCsv={handleExportCsv} onPrint={handlePrint} />

	<div class="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
		<DateRangeFilter bind:dateFrom bind:dateTo {loading} onApply={applyFilter} />
		<a
			href={resolve('/cash/expenses')}
			class="inline-flex w-full items-center justify-center rounded-lg bg-brand-blue px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-blue/90 sm:w-auto lg:shrink-0"
		>
			Gestionar egresos
		</a>
	</div>

	<!-- Mobile compact summary -->
	<div class="mb-5 lg:hidden">
		<div class="glass-card overflow-hidden">
			<div class="border-b border-slate-200 px-3 py-2.5">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 class="text-sm font-semibold text-slate-900">Resumen del período</h2>
						<p class="mt-0.5 text-[11px] text-slate-500">
							Vista compacta de caja, utilidad y egresos.
						</p>
					</div>
					{#if report.cogsIncomplete}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700"
						>
							<AlertTriangle size={11} />
							Costo pendiente
						</span>
					{/if}
				</div>
			</div>

			<div class="grid grid-cols-2 gap-px bg-slate-200/80">
				<div class="bg-white px-3 py-2.5">
					<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
						Ingresos
					</p>
					<p class="font-heading mt-1 text-lg font-bold text-brand-navy">
						{formatPrice(report.grossRevenue)}
					</p>
					<p class="mt-0.5 text-[11px] text-slate-400">
						{report.salesCount} venta{report.salesCount === 1 ? '' : 's'}
					</p>
				</div>
				<div class="bg-white px-3 py-2.5">
					<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">Otros</p>
					<p class="font-heading mt-1 text-lg font-bold text-teal-700">
						{formatPrice(report.otherIncome)}
					</p>
					<p class="mt-0.5 text-[11px] text-slate-400">
						{report.retainedSalesCount} retenido{report.retainedSalesCount === 1 ? '' : 's'}
					</p>
				</div>
				<div class="bg-white px-3 py-2.5">
					<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
						Cobrado
					</p>
					<p class="font-heading mt-1 text-lg font-bold text-blue-700">
						{formatPrice(report.totalCollected)}
					</p>
					<p class="mt-0.5 text-[11px] text-slate-400">
						{report.paymentsCount} pago{report.paymentsCount === 1 ? '' : 's'}
					</p>
				</div>
				<div class="bg-white px-3 py-2.5">
					<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">Costo</p>
					<p class="font-heading mt-1 text-lg font-bold text-violet-700">
						{formatPrice(report.totalCogs)}
					</p>
					<p class="mt-0.5 text-[11px] text-slate-400">COGS entregado</p>
				</div>
				<div class="bg-white px-3 py-2.5">
					<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">Bruta</p>
					<p class="font-heading mt-1 text-lg font-bold text-brand-navy">
						{formatPrice(report.grossProfit)}
					</p>
					<p class="mt-0.5 text-[11px] text-slate-400">Margen {formatPct(report.grossMarginPct)}</p>
				</div>
				<div class="bg-white px-3 py-2.5">
					<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">Neta</p>
					<p
						class="font-heading mt-1 text-lg font-bold {report.netProfit >= 0
							? 'text-emerald-700'
							: 'text-rose-700'}"
					>
						{formatPrice(report.netProfit)}
					</p>
					<p class="mt-0.5 text-[11px] text-slate-400">Tras egresos</p>
				</div>
				<div class="bg-white px-3 py-2.5">
					<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
						Egresos
					</p>
					<p class="font-heading mt-1 text-lg font-bold text-rose-700">
						{formatPrice(report.totalExpenses)}
					</p>
					<p class="mt-0.5 text-[11px] text-slate-400">
						{report.expensesCount} registro{report.expensesCount === 1 ? '' : 's'}
					</p>
				</div>
				<div class="bg-white px-3 py-2.5">
					<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
						Fórmula
					</p>
					<p class="mt-1 text-sm font-semibold text-slate-700">Ingresos + Otros</p>
					<p class="mt-0.5 text-[11px] text-slate-400">− Costo − Egresos</p>
				</div>
			</div>

			<div class="space-y-2 border-t border-slate-200 px-3 py-2.5">
				<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
					Egresos por categoría
				</p>
				{#if report.expensesByCategory.length === 0}
					<p class="text-[11px] text-slate-400">Sin egresos en el período</p>
				{:else}
					<ul class="space-y-1 text-[11px]">
						{#each report.expensesByCategory as row (row.category)}
							<li class="flex items-center justify-between gap-3">
								<span class="truncate text-slate-600">{EXPENSE_CATEGORY_LABELS[row.category]}</span>
								<span class="font-mono font-semibold text-slate-800">{formatPrice(row.total)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</div>

	<!-- Top KPIs -->
	<div class="mb-6 hidden gap-4 lg:grid lg:grid-cols-2 xl:grid-cols-5">
		<div class="glass-card p-4 sm:p-5">
			<div class="mb-2 flex items-center gap-2 text-emerald-600">
				<TrendingUp size={18} />
				<p class="text-xs font-semibold tracking-wider uppercase">Ingresos realizados</p>
			</div>
			<p class="font-heading text-2xl font-bold text-brand-navy sm:text-3xl">
				{formatPrice(report.grossRevenue)}
			</p>
			<p class="mt-1 text-xs text-slate-400">
				{report.salesCount} venta{report.salesCount === 1 ? '' : 's'} entregada{report.salesCount ===
				1
					? ''
					: 's'}
			</p>
		</div>

		<div class="glass-card p-4 sm:p-5">
			<div class="mb-2 flex items-center gap-2 text-teal-600">
				<PlusCircle size={18} />
				<p class="text-xs font-semibold tracking-wider uppercase">Otros ingresos</p>
			</div>
			<p class="font-heading text-2xl font-bold text-brand-navy sm:text-3xl">
				{formatPrice(report.otherIncome)}
			</p>
			<p class="mt-1 text-xs text-slate-400">
				{#if report.retainedSalesCount === 0}
					Sin retenciones
				{:else}
					{report.retainedSalesCount} anticipo{report.retainedSalesCount === 1 ? '' : 's'} retenido{report.retainedSalesCount ===
					1
						? ''
						: 's'}
				{/if}
			</p>
		</div>

		<div class="glass-card p-4 sm:p-5">
			<div class="mb-2 flex items-center gap-2 text-blue-600">
				<Wallet size={18} />
				<p class="text-xs font-semibold tracking-wider uppercase">Cobrado (caja)</p>
			</div>
			<p class="font-heading text-2xl font-bold text-brand-navy sm:text-3xl">
				{formatPrice(report.totalCollected)}
			</p>
			<p class="mt-1 text-xs text-slate-400">
				{report.paymentsCount} pago{report.paymentsCount === 1 ? '' : 's'}
			</p>
		</div>

		<div class="glass-card p-4 sm:p-5 {report.cogsIncomplete ? 'border-amber-200' : ''}">
			<div class="mb-2 flex items-center gap-2 text-violet-600">
				<TrendingDown size={18} />
				<p class="text-xs font-semibold tracking-wider uppercase">Costo (COGS)</p>
			</div>
			<p class="font-heading text-2xl font-bold text-brand-navy sm:text-3xl">
				{formatPrice(report.totalCogs)}
			</p>
			{#if report.cogsIncomplete}
				<p class="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600">
					<AlertTriangle size={12} />
					Algunos ítems sin costo registrado
				</p>
			{/if}
		</div>

		<div class="glass-card p-4 sm:p-5">
			<div class="mb-2 flex items-center gap-2 text-rose-600">
				<Receipt size={18} />
				<p class="text-xs font-semibold tracking-wider uppercase">Egresos</p>
			</div>
			<p class="font-heading text-2xl font-bold text-brand-navy sm:text-3xl">
				{formatPrice(report.totalExpenses)}
			</p>
			<p class="mt-1 text-xs text-slate-400">
				{report.expensesCount} egreso{report.expensesCount === 1 ? '' : 's'}
			</p>
		</div>
	</div>

	<!-- P&L summary -->
	<div class="mb-8 hidden gap-4 lg:grid xl:grid-cols-3">
		<div
			class="glass-card flex items-center justify-between p-5 {report.grossProfit >= 0
				? 'bg-emerald-50/40'
				: 'bg-rose-50/40'}"
		>
			<div>
				<p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Utilidad Bruta</p>
				<p class="font-heading mt-1 text-2xl font-bold text-brand-navy">
					{formatPrice(report.grossProfit)}
				</p>
				<p class="mt-1 text-xs text-slate-500">
					= Ingresos{report.otherIncome > 0 ? ' + Otros' : ''} − Costo · Margen: {formatPct(
						report.grossMarginPct
					)}
				</p>
			</div>
		</div>

		<div
			class="glass-card flex items-center justify-between p-5 {report.netProfit >= 0
				? 'bg-emerald-50/40'
				: 'bg-rose-50/40'}"
		>
			<div>
				<p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Utilidad Neta</p>
				<p
					class="font-heading mt-1 text-2xl font-bold {report.netProfit >= 0
						? 'text-emerald-700'
						: 'text-rose-700'}"
				>
					{formatPrice(report.netProfit)}
				</p>
				<p class="mt-1 text-xs text-slate-500">= Bruta − Egresos</p>
			</div>
		</div>

		<div class="glass-card p-5">
			<p
				class="mb-3 flex items-center gap-2 text-xs font-semibold tracking-wider text-slate-500 uppercase"
			>
				<ListChecks size={14} />
				Egresos por categoría
			</p>
			{#if report.expensesByCategory.length === 0}
				<p class="text-sm text-slate-400">Sin egresos en el período</p>
			{:else}
				<ul class="space-y-1.5 text-sm">
					{#each report.expensesByCategory as row (row.category)}
						<li class="flex items-center justify-between">
							<span class="text-slate-600">{EXPENSE_CATEGORY_LABELS[row.category]}</span>
							<span class="font-mono font-semibold text-slate-800">{formatPrice(row.total)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>

	<!-- Pipeline (in-progress sales — billed but not delivered) -->
	<div class="glass-card mb-5 p-3 lg:hidden">
		<div class="mb-3 flex items-start justify-between gap-3">
			<div>
				<h2 class="flex items-center gap-2 text-sm font-semibold text-slate-800">
					<Package size={16} class="text-amber-600" />
					Pipeline
				</h2>
				<p class="mt-0.5 text-[11px] text-slate-500">
					Facturadas sin completar. No cuentan como ingreso todavía.
				</p>
			</div>
			{#if pipeline.cogsIncomplete}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700"
				>
					<AlertTriangle size={11} />
					Costo pendiente
				</span>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-slate-200 pt-2.5 text-sm">
			<div>
				<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">Abiertas</p>
				<p class="font-heading mt-0.5 text-lg font-bold text-brand-navy">
					{pipeline.openSalesCount}
				</p>
			</div>
			<div>
				<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
					Facturado
				</p>
				<p class="font-heading mt-0.5 text-lg font-bold text-brand-navy">
					{formatPrice(pipeline.totalBilled)}
				</p>
			</div>
			<div>
				<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
					Anticipos
				</p>
				<p class="font-heading mt-0.5 text-lg font-bold text-blue-700">
					{formatPrice(pipeline.totalCollected)}
				</p>
			</div>
			<div>
				<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
					Por cobrar
				</p>
				<p class="font-heading mt-0.5 text-lg font-bold text-rose-700">
					{formatPrice(pipeline.totalPending)}
				</p>
			</div>
			<div class="col-span-2 border-t border-slate-200 pt-2">
				<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
					Utilidad esperada
				</p>
				<div class="mt-0.5 flex items-end justify-between gap-3">
					<p
						class="font-heading text-lg font-bold {pipeline.expectedGrossProfit >= 0
							? 'text-emerald-700'
							: 'text-rose-700'}"
					>
						{formatPrice(pipeline.expectedGrossProfit)}
					</p>
					<p class="text-[11px] text-slate-400">Costo proy. {formatPrice(pipeline.expectedCogs)}</p>
				</div>
			</div>
		</div>
	</div>

	<div class="glass-card mb-8 hidden p-4 sm:p-5 lg:block">
		<div class="mb-4 flex items-start justify-between gap-4">
			<div>
				<h2 class="flex items-center gap-2 text-base font-semibold text-slate-800">
					<Package size={18} class="text-amber-600" />
					Pipeline · ventas por entregar
				</h2>
				<p class="mt-0.5 text-xs text-slate-500">
					Ventas facturadas pero aún en producción / sin pagar 100%. No cuentan como ingreso hasta
					completarse.
				</p>
			</div>
			{#if pipeline.cogsIncomplete}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
				>
					<AlertTriangle size={12} />
					Algunos ítems sin costo
				</span>
			{/if}
		</div>

		<div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
			<div class="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
				<p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Ventas abiertas</p>
				<p class="font-heading mt-1 text-2xl font-bold text-brand-navy">
					{pipeline.openSalesCount}
				</p>
			</div>
			<div class="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
				<p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Facturado</p>
				<p class="font-heading mt-1 text-2xl font-bold text-brand-navy">
					{formatPrice(pipeline.totalBilled)}
				</p>
			</div>
			<div class="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
				<p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
					Anticipos cobrados
				</p>
				<p class="font-heading mt-1 text-2xl font-bold text-blue-700">
					{formatPrice(pipeline.totalCollected)}
				</p>
			</div>
			<div class="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3">
				<p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Por cobrar</p>
				<p class="font-heading mt-1 text-2xl font-bold text-rose-700">
					{formatPrice(pipeline.totalPending)}
				</p>
			</div>
			<div
				class="rounded-lg border border-slate-200/80 bg-slate-50/70 p-3 sm:col-span-2 xl:col-span-1"
			>
				<p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">
					Utilidad esperada
				</p>
				<p
					class="font-heading mt-1 text-2xl font-bold {pipeline.expectedGrossProfit >= 0
						? 'text-emerald-700'
						: 'text-rose-700'}"
				>
					{formatPrice(pipeline.expectedGrossProfit)}
				</p>
				<p class="mt-0.5 text-xs text-slate-400">
					Costo proy.: {formatPrice(pipeline.expectedCogs)}
				</p>
			</div>
		</div>
	</div>

	<!-- Daily breakdown -->
	<div class="glass-card overflow-hidden">
		<div class="border-b border-slate-200 px-3 py-2.5 lg:px-5 lg:py-3">
			<h2 class="text-base font-semibold text-slate-800">Detalle diario</h2>
		</div>
		<div class="grid gap-2.5 p-3 lg:hidden">
			{#each daily as row (row.date)}
				<article class="rounded-lg border border-slate-200 bg-white p-3">
					<div class="mb-2 flex items-start justify-between gap-3">
						<div>
							<p class="text-[13px] font-semibold text-slate-900">
								{formatDate(row.date, { dateStyle: 'medium' })}
							</p>
							<p class="mt-0.5 text-[11px] text-slate-500">
								{row.salesCount} venta{row.salesCount === 1 ? '' : 's'} reconocida{row.salesCount ===
								1
									? ''
									: 's'}
							</p>
						</div>
						<div class="text-right">
							<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
								Util. neta
							</p>
							<p
								class="font-mono text-[13px] font-semibold tabular-nums {row.netProfit >= 0
									? 'text-emerald-700'
									: 'text-rose-700'}"
							>
								{formatPrice(row.netProfit)}
							</p>
						</div>
					</div>

					<div class="grid grid-cols-3 gap-x-3 gap-y-2 text-[11px]">
						<div>
							<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
								Ingresos
							</p>
							<p class="font-mono text-[13px] text-slate-800 tabular-nums">
								{formatPrice(row.revenue)}
							</p>
						</div>
						<div>
							<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
								Otros
							</p>
							<p
								class="font-mono text-[13px] tabular-nums {row.otherIncome > 0
									? 'text-teal-700'
									: 'text-slate-400'}"
							>
								{formatPrice(row.otherIncome)}
							</p>
						</div>
						<div>
							<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
								Cobrado
							</p>
							<p class="font-mono text-[13px] text-slate-800 tabular-nums">
								{formatPrice(row.collected)}
							</p>
						</div>
						<div>
							<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
								Costo
							</p>
							<p class="font-mono text-[13px] text-violet-700 tabular-nums">
								{formatPrice(row.cogs)}
							</p>
						</div>
						<div>
							<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
								Util. bruta
							</p>
							<p class="font-mono text-[13px] text-slate-800 tabular-nums">
								{formatPrice(row.grossProfit)}
							</p>
						</div>
						<div>
							<p class="text-[10px] font-semibold tracking-[0.08em] text-slate-500 uppercase">
								Egresos
							</p>
							<p class="font-mono text-[13px] text-rose-700 tabular-nums">
								{formatPrice(row.expenses)}
							</p>
						</div>
					</div>
				</article>
			{:else}
				<div
					class="rounded-lg border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-400"
				>
					Sin movimientos en el período seleccionado
				</div>
			{/each}
		</div>
		<div class="hidden overflow-x-auto lg:block">
			<table class="w-full text-left text-sm">
				<thead class="border-b border-slate-200 bg-slate-50 text-xs text-slate-600 uppercase">
					<tr>
						<th class="px-4 py-3">Fecha</th>
						<th class="px-4 py-3 text-right">Ventas</th>
						<th class="px-4 py-3 text-right">Ingresos</th>
						<th class="px-4 py-3 text-right">Otros</th>
						<th class="px-4 py-3 text-right">Cobrado</th>
						<th class="px-4 py-3 text-right">Costo</th>
						<th class="px-4 py-3 text-right">Util. Bruta</th>
						<th class="px-4 py-3 text-right">Egresos</th>
						<th class="px-4 py-3 text-right">Util. Neta</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100">
					{#each daily as row (row.date)}
						<tr class="hover:bg-slate-50">
							<td class="px-4 py-3">
								{formatDate(row.date, { dateStyle: 'medium' })}
							</td>
							<td class="px-4 py-3 text-right font-mono">{row.salesCount}</td>
							<td class="px-4 py-3 text-right font-mono">{formatPrice(row.revenue)}</td>
							<td
								class="px-4 py-3 text-right font-mono {row.otherIncome > 0
									? 'text-teal-700'
									: 'text-slate-300'}"
							>
								{formatPrice(row.otherIncome)}
							</td>
							<td class="px-4 py-3 text-right font-mono">{formatPrice(row.collected)}</td>
							<td class="px-4 py-3 text-right font-mono text-violet-700">{formatPrice(row.cogs)}</td
							>
							<td class="px-4 py-3 text-right font-mono">{formatPrice(row.grossProfit)}</td>
							<td class="px-4 py-3 text-right font-mono text-rose-700"
								>{formatPrice(row.expenses)}</td
							>
							<td
								class="px-4 py-3 text-right font-mono font-semibold {row.netProfit >= 0
									? 'text-emerald-700'
									: 'text-rose-700'}"
							>
								{formatPrice(row.netProfit)}
							</td>
						</tr>
					{:else}
						<tr>
							<td colspan="9" class="px-4 py-8 text-center text-slate-400">
								Sin movimientos en el período seleccionado
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
