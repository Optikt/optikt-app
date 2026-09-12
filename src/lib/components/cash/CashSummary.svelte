<script lang="ts">
	import { AlertTriangle } from '@lucide/svelte';
	import { EXPENSE_CATEGORY_LABELS } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import { formatPct } from './cashReport';
	import {
		desktopLabelClass,
		desktopValueClass,
		mobileInsetClass,
		mobileLabelClass,
		mobileMetaClass,
		mobileSurfaceClass,
		mobileValueClass
	} from './cashClasses';
	import type { CashReport } from '$lib/server/db/queries/cash';

	interface Props {
		report: CashReport;
	}

	let { report }: Props = $props();
</script>

<div class="mb-5 lg:hidden">
	<div class={`${mobileSurfaceClass} overflow-hidden`}>
		<div class="flex items-center justify-between border-b border-surface-container-high px-4 py-3">
			<p class={mobileLabelClass}>Resumen P&amp;L</p>
			{#if report.cogsIncomplete}
				<span
					class="inline-flex items-center gap-1 rounded-full bg-brand-gold/15 px-2 py-1 text-[10px] font-medium text-brand-navy"
				>
					<AlertTriangle size={11} />
					Costo pendiente
				</span>
			{/if}
		</div>

		<div class="grid grid-cols-2 gap-2 p-3">
			<div class={mobileInsetClass}>
				<p class={mobileLabelClass}>Ingresos realiz.</p>
				<p class={mobileValueClass}>
					{formatPrice(report.grossRevenue)}
				</p>
				<p class={mobileMetaClass}>
					{report.salesCount} venta{report.salesCount === 1 ? '' : 's'}
				</p>
			</div>
			<div class={mobileInsetClass}>
				<p class={mobileLabelClass}>Costo (COGS)</p>
				<p class={mobileValueClass}>
					{formatPrice(report.totalCogs)}
				</p>
				<p class={mobileMetaClass}>COGS entregado</p>
			</div>
			<div class={mobileInsetClass}>
				<p class={mobileLabelClass}>Otros ingresos</p>
				<p class="mt-1 font-mono text-[15px] font-semibold text-brand-blue tabular-nums">
					{formatPrice(report.otherIncome)}
				</p>
				<p class={mobileMetaClass}>
					{report.retainedSalesCount} retenido{report.retainedSalesCount === 1 ? '' : 's'}
				</p>
			</div>
			<div class={mobileInsetClass}>
				<p class={mobileLabelClass}>Egresos op.</p>
				<p class="mt-1 font-mono text-[15px] font-semibold text-rose-700 tabular-nums">
					{formatPrice(report.totalExpenses)}
				</p>
				<p class={mobileMetaClass}>
					{report.expensesCount} registro{report.expensesCount === 1 ? '' : 's'}
				</p>
			</div>
			<div class={mobileInsetClass}>
				<p class={mobileLabelClass}>Desc. compras</p>
				<p class="mt-1 font-mono text-[15px] font-semibold text-emerald-700 tabular-nums">
					{formatPrice(report.purchaseDiscountsEarned)}
				</p>
				<p class={mobileMetaClass}>Ingreso financiero</p>
			</div>
			{#if report.exchangeSettlementVariance !== 0}
				<div class={mobileInsetClass}>
					<p class={mobileLabelClass}>Variación cambiaria</p>
					<p
						class="mt-1 font-mono text-[15px] font-semibold tabular-nums {report.exchangeSettlementVariance >
						0
							? 'text-emerald-700'
							: 'text-red-700'}"
					>
						{report.exchangeSettlementVariance > 0 ? '+' : ''}{formatPrice(
							report.exchangeSettlementVariance
						)}
					</p>
					<p class={mobileMetaClass}>
						{report.exchangeSettlementVariance > 0 ? 'Ganancia' : 'Pérdida'} tasa
					</p>
				</div>
			{/if}
			<div class={mobileInsetClass}>
				<p class={mobileLabelClass}>Cobrado (caja)</p>
				<p class={mobileValueClass}>
					{formatPrice(report.totalCollected)}
				</p>
				<p class={mobileMetaClass}>
					{report.paymentsCount} pago{report.paymentsCount === 1 ? '' : 's'}
				</p>
			</div>
			<div class={mobileInsetClass}>
				<p class={mobileLabelClass}>Utilidad bruta</p>
				<p class={mobileValueClass}>
					{formatPrice(report.grossProfit)}
				</p>
				<p class={mobileMetaClass}>Margen {formatPct(report.grossMarginPct)}</p>
			</div>
			<div class="col-span-2 rounded-xl bg-surface-container-low px-3 py-3">
				<div class="flex items-start justify-between gap-3">
					<div>
						<p class={mobileLabelClass}>Utilidad neta</p>
						<p
							class="mt-1 font-mono text-[17px] font-semibold tabular-nums {report.netProfit >= 0
								? 'text-emerald-700'
								: 'text-rose-700'}"
						>
							{formatPrice(report.netProfit)}
						</p>
					</div>
					<div class="text-right">
						<p class={mobileLabelClass}>Lectura</p>
						<p class="mt-1 text-[11px] font-medium text-on-surface-variant">
							Bruta - egresos + desc.
						</p>
					</div>
				</div>
			</div>
		</div>

		<div class="space-y-2 border-t border-surface-container-high px-4 py-3">
			<div class="flex items-center justify-between gap-3">
				<p class={mobileLabelClass}>Egresos por categoría</p>
				<p class="text-[10px] text-on-surface-variant">Ver detalle en egresos</p>
			</div>
			{#if report.expensesByCategory.length === 0}
				<p class="text-[11px] text-on-surface-variant">Sin egresos en el período</p>
			{:else}
				<ul class="space-y-1 text-[11px]">
					{#each report.expensesByCategory as row (row.category)}
						<li class="flex items-center justify-between gap-3">
							<span class="inline-flex min-w-0 items-center gap-2 truncate text-on-surface-variant">
								<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue/40"></span>
								<span class="truncate">{EXPENSE_CATEGORY_LABELS[row.category]}</span>
							</span>
							<span class="font-mono font-semibold text-brand-navy">{formatPrice(row.total)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>
<div class="mb-6 hidden lg:block">
	<div class="glass-card overflow-hidden">
		<div class="grid items-stretch gap-px bg-slate-200 lg:grid-cols-4 xl:grid-cols-8">
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Ingresos realiz.</p>
				<p class={desktopValueClass}>{formatPrice(report.grossRevenue)}</p>
				<p class="mt-2 text-xs text-slate-500">
					{report.salesCount} venta{report.salesCount === 1 ? '' : 's'} entregada{report.salesCount ===
					1
						? ''
						: 's'}
				</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Otros ingresos</p>
				<p class={desktopValueClass}>{formatPrice(report.otherIncome)}</p>
				<p class="mt-2 text-xs text-slate-500">
					{report.retainedSalesCount === 0
						? 'Sin retenciones'
						: `${report.retainedSalesCount} retenido${report.retainedSalesCount === 1 ? '' : 's'}`}
				</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Cobrado</p>
				<p class={desktopValueClass}>{formatPrice(report.totalCollected)}</p>
				<p class="mt-2 text-xs text-slate-500">
					{report.paymentsCount} pago{report.paymentsCount === 1 ? '' : 's'} registrados
				</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Desc. compras</p>
				<p
					class="mt-2 font-mono text-[1.6rem] leading-none font-semibold text-emerald-700 tabular-nums"
				>
					{formatPrice(report.purchaseDiscountsEarned)}
				</p>
				<p class="mt-2 text-xs text-slate-500">Ingreso financiero</p>
			</div>
			{#if report.exchangeSettlementVariance !== 0}
				<div class="flex h-full flex-col bg-white px-4 py-4">
					<p class={desktopLabelClass}>Variación cambiaria</p>
					<p
						class="mt-2 font-mono text-[1.6rem] leading-none font-semibold tabular-nums {report.exchangeSettlementVariance >
						0
							? 'text-emerald-700'
							: 'text-red-700'}"
					>
						{report.exchangeSettlementVariance > 0 ? '+' : ''}{formatPrice(
							report.exchangeSettlementVariance
						)}
					</p>
					<p class="mt-2 text-xs text-slate-500">
						{report.exchangeSettlementVariance > 0 ? 'Ganancia' : 'Pérdida'} por diferencia de tasa
					</p>
				</div>
			{/if}
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Costo (COGS)</p>
				<p class={desktopValueClass}>{formatPrice(report.totalCogs)}</p>
				{#if report.cogsIncomplete}
					<p class="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
						<AlertTriangle size={12} />
						Costo pendiente
					</p>
				{:else}
					<p class="mt-2 text-xs text-slate-500">Costo entregado</p>
				{/if}
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Egresos op.</p>
				<p
					class="mt-2 font-mono text-[1.6rem] leading-none font-semibold text-rose-700 tabular-nums"
				>
					{formatPrice(report.totalExpenses)}
				</p>
				<p class="mt-2 text-xs text-slate-500">
					{report.expensesCount} registro{report.expensesCount === 1 ? '' : 's'}
				</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Utilidad bruta</p>
				<p
					class="mt-2 font-mono text-[1.6rem] leading-none font-semibold text-brand-navy tabular-nums"
				>
					{formatPrice(report.grossProfit)}
				</p>
				<p class="mt-2 text-xs text-slate-500">Margen {formatPct(report.grossMarginPct)}</p>
			</div>
			<div class="flex h-full flex-col bg-white px-4 py-4">
				<p class={desktopLabelClass}>Utilidad neta</p>
				<p
					class="mt-2 font-mono text-[1.6rem] leading-none font-semibold tabular-nums {report.netProfit >=
					0
						? 'text-emerald-700'
						: 'text-rose-700'}"
				>
					{formatPrice(report.netProfit)}
				</p>
				<p class="mt-2 text-xs text-slate-500">Bruta - egresos + desc.</p>
			</div>
		</div>
	</div>
</div>
