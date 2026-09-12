<script lang="ts">
	import { AlertTriangle, Package } from '@lucide/svelte';
	import { EXPENSE_CATEGORY_LABELS } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import { formatPct } from './cashReport';
	import {
		desktopLabelClass,
		desktopValueClass,
		mobileInsetClass,
		mobileLabelClass,
		mobileSurfaceClass,
		mobileValueClass
	} from './cashClasses';
	import type { CashReport, PipelineSnapshot } from '$lib/server/db/queries/cash';

	interface Props {
		report: CashReport;
		pipeline: PipelineSnapshot;
	}

	let { report, pipeline }: Props = $props();
</script>

<div class={`${mobileSurfaceClass} mb-5 p-4 lg:hidden`}>
	<div class="mb-3 flex items-start justify-between gap-3">
		<div>
			<h2
				class="flex items-center gap-2 text-base font-semibold tracking-[-0.02em] text-brand-navy"
			>
				<Package size={16} class="text-brand-gold-dark" />
				Pipeline · ventas por entregar
			</h2>
			<p class="mt-1 text-[11px] text-on-surface-variant">
				Facturadas sin completar. No cuentan como ingreso todavía.
			</p>
		</div>
		{#if pipeline.cogsIncomplete}
			<span
				class="inline-flex items-center gap-1 rounded-full bg-brand-gold/15 px-2 py-1 text-[10px] font-medium text-brand-navy"
			>
				<AlertTriangle size={11} />
				Costo pendiente
			</span>
		{/if}
	</div>

	<div class="grid grid-cols-2 gap-2 border-t border-surface-container-high pt-3 text-sm">
		<div class={mobileInsetClass}>
			<p class={mobileLabelClass}>Abiertas</p>
			<p class={mobileValueClass}>
				{pipeline.openSalesCount}
			</p>
		</div>
		<div class={mobileInsetClass}>
			<p class={mobileLabelClass}>Facturado</p>
			<p class={mobileValueClass}>
				{formatPrice(pipeline.totalBilled)}
			</p>
		</div>
		<div class={mobileInsetClass}>
			<p class={mobileLabelClass}>Anticipos</p>
			<p class="mt-1 font-mono text-[15px] font-semibold text-brand-blue tabular-nums">
				{formatPrice(pipeline.totalCollected)}
			</p>
		</div>
		<div class={mobileInsetClass}>
			<p class={mobileLabelClass}>Por cobrar</p>
			<p class="mt-0.5 font-mono text-[15px] font-semibold text-rose-700 tabular-nums">
				{formatPrice(pipeline.totalPending)}
			</p>
		</div>
		<div class="col-span-2 rounded-xl bg-surface-container-low px-3 py-3">
			<p class={mobileLabelClass}>Utilidad esperada</p>
			<div class="mt-1 flex items-end justify-between gap-3">
				<p
					class="font-mono text-[15px] font-semibold tabular-nums {pipeline.expectedGrossProfit >= 0
						? 'text-emerald-700'
						: 'text-rose-700'}"
				>
					{formatPrice(pipeline.expectedGrossProfit)}
				</p>
				<p class="text-[11px] text-on-surface-variant">
					Costo proy. {formatPrice(pipeline.expectedCogs)}
				</p>
			</div>
		</div>
	</div>
</div>

<div
	class="mb-8 hidden lg:grid lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] lg:items-stretch lg:gap-4"
>
	<section class="glass-card flex h-full flex-col overflow-hidden">
		<div
			class="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50/80 px-5 py-4"
		>
			<div>
				<p class={desktopLabelClass}>Pipeline</p>
				<h2
					class="mt-1 flex items-center gap-2 text-lg font-semibold tracking-[-0.02em] text-brand-navy"
				>
					<Package size={18} class="text-brand-gold-dark" />
					Ventas por entregar
				</h2>
				<p class="mt-1 text-sm text-slate-500">
					Facturadas sin completarse. No cuentan como ingreso hasta entregarse.
				</p>
			</div>
			{#if pipeline.cogsIncomplete}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700"
				>
					<AlertTriangle size={12} />
					Costo pendiente
				</span>
			{/if}
		</div>

		<div class="grid items-stretch gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-5">
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Ventas abiertas</p>
				<p class={desktopValueClass}>{pipeline.openSalesCount}</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Facturado</p>
				<p class={desktopValueClass}>{formatPrice(pipeline.totalBilled)}</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Anticipos</p>
				<p
					class="mt-2 font-mono text-[1.6rem] leading-none font-semibold text-brand-blue tabular-nums"
				>
					{formatPrice(pipeline.totalCollected)}
				</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Por cobrar</p>
				<p
					class="mt-2 font-mono text-[1.6rem] leading-none font-semibold text-rose-700 tabular-nums"
				>
					{formatPrice(pipeline.totalPending)}
				</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Utilidad esperada</p>
				<p
					class="mt-2 font-mono text-[1.6rem] leading-none font-semibold tabular-nums {pipeline.expectedGrossProfit >=
					0
						? 'text-emerald-700'
						: 'text-rose-700'}"
				>
					{formatPrice(pipeline.expectedGrossProfit)}
				</p>
				<p class="mt-2 text-xs text-slate-500">
					Costo proy. {formatPrice(pipeline.expectedCogs)}
				</p>
			</div>
		</div>
	</section>

	<aside class="glass-card flex h-full flex-col overflow-hidden">
		<div class="border-b border-slate-200 bg-slate-50/80 px-5 py-4">
			<p class={desktopLabelClass}>Lectura rápida</p>
			<h2 class="mt-1 text-lg font-semibold tracking-[-0.02em] text-brand-navy">
				Contexto operativo
			</h2>
		</div>

		<div class="flex flex-1 flex-col gap-4 px-5 py-4">
			<div class="space-y-3 text-sm">
				<div class="flex items-center justify-between gap-3">
					<span class="text-slate-600">Margen bruto</span>
					<span class="font-mono font-semibold text-brand-navy tabular-nums"
						>{formatPct(report.grossMarginPct)}</span
					>
				</div>
				<div class="flex items-center justify-between gap-3">
					<span class="text-slate-600">Cobrado vs realizado</span>
					<span class="font-mono font-semibold text-brand-navy tabular-nums"
						>{formatPrice(report.totalCollected)}</span
					>
				</div>
				<div class="flex items-center justify-between gap-3">
					<span class="text-slate-600">Retenido</span>
					<span class="font-mono font-semibold text-brand-navy tabular-nums"
						>{formatPrice(report.otherIncome)}</span
					>
				</div>
				<div class="flex items-center justify-between gap-3">
					<span class="text-slate-600">Descuentos en compras</span>
					<span class="font-mono font-semibold text-emerald-700 tabular-nums"
						>{formatPrice(report.purchaseDiscountsEarned)}</span
					>
				</div>
				<div class="flex items-center justify-between gap-3">
					<span class="text-slate-600">Pagos registrados</span>
					<span class="font-mono font-semibold text-brand-navy tabular-nums"
						>{report.paymentsCount}</span
					>
				</div>
			</div>

			<div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-4">
				<p class={desktopLabelClass}>Egresos por categoría</p>
				{#if report.expensesByCategory.length === 0}
					<p class="mt-2 text-sm text-slate-500">Sin egresos en el período</p>
				{:else}
					<ul class="mt-3 space-y-2 text-sm">
						{#each report.expensesByCategory as row (row.category)}
							<li class="flex items-center justify-between gap-3">
								<span class="truncate text-slate-600">{EXPENSE_CATEGORY_LABELS[row.category]}</span>
								<span class="font-mono font-semibold text-brand-navy tabular-nums"
									>{formatPrice(row.total)}</span
								>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</aside>
</div>
