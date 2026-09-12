<script lang="ts">
	import { formatDate, formatPrice } from '$lib/utils';
	import { mobileInsetClass, mobileLabelClass } from './cashClasses';
	import type { DailyBreakdownRow } from '$lib/server/db/queries/cash';

	interface Props {
		daily: DailyBreakdownRow[];
	}

	let { daily }: Props = $props();
</script>

<div class="glass-card overflow-hidden">
	<div class="border-b border-slate-200 px-3 py-2.5 lg:px-5 lg:py-4">
		<div class="flex items-start justify-between gap-4">
			<div>
				<h2 class="text-base font-semibold tracking-[-0.02em] text-brand-navy">Detalle diario</h2>
				<p class="mt-0.5 hidden text-xs text-slate-500 lg:block">
					Ledger diario con ingresos realizados, cobrado en caja, costos y utilidad.
				</p>
			</div>
			<span
				class="hidden items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-brand-navy uppercase lg:inline-flex"
			>
				{daily.length} corte{daily.length === 1 ? '' : 's'}
			</span>
		</div>
	</div>
	<div class="divide-y divide-surface-container-high lg:hidden">
		{#each daily as row (row.date)}
			<article class="bg-surface-container-lowest px-4 py-4">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<p class="truncate text-[15px] font-semibold tracking-[-0.02em] text-brand-navy">
							{formatDate(row.date, { dateStyle: 'medium' })}
						</p>
						<p class="mt-1 text-[11px] text-on-surface-variant">
							{row.salesCount} venta{row.salesCount === 1 ? '' : 's'}
						</p>
					</div>

					<div class="min-w-[8.4rem] rounded-xl bg-surface-container-low px-3 py-3 text-right">
						<p class={mobileLabelClass}>Utilidad neta</p>
						<p
							class="mt-1 font-mono text-[15px] font-semibold tabular-nums {row.netProfit >= 0
								? 'text-emerald-700'
								: 'text-rose-700'}"
						>
							{formatPrice(row.netProfit)}
						</p>
					</div>
				</div>

				<div class="mt-3 grid grid-cols-2 gap-2">
					<div class={mobileInsetClass}>
						<p class={mobileLabelClass}>Cobrado</p>
						<p class="mt-1 font-mono text-[15px] font-semibold text-brand-navy tabular-nums">
							{formatPrice(row.collected)}
						</p>
					</div>
					<div class={mobileInsetClass}>
						<p class={mobileLabelClass}>Egresos</p>
						<p class="mt-1 font-mono text-[15px] font-semibold text-rose-700 tabular-nums">
							{formatPrice(row.expenses)}
						</p>
					</div>
				</div>

				<div class="mt-3 grid grid-cols-2 gap-2 border-t border-surface-container-high pt-3">
					<div class="rounded-xl bg-surface-container-low px-3 py-2.5">
						<p class={mobileLabelClass}>Ingresos</p>
						<p class="mt-1 font-mono text-[13px] font-semibold text-brand-navy tabular-nums">
							{formatPrice(row.revenue)}
						</p>
					</div>
					<div class="rounded-xl bg-surface-container-low px-3 py-2.5">
						<p class={mobileLabelClass}>Otros</p>
						<p class="mt-1 font-mono text-[13px] font-semibold text-brand-blue tabular-nums">
							{formatPrice(row.otherIncome)}
						</p>
					</div>
					<div class="rounded-xl bg-surface-container-low px-3 py-2.5">
						<p class={mobileLabelClass}>Desc. compras</p>
						<p class="mt-1 font-mono text-[13px] font-semibold text-emerald-700 tabular-nums">
							{formatPrice(row.purchaseDiscountsEarned)}
						</p>
					</div>
					<div class="rounded-xl bg-surface-container-low px-3 py-2.5">
						<p class={mobileLabelClass}>Costo</p>
						<p class="mt-1 font-mono text-[13px] font-semibold text-brand-navy tabular-nums">
							{formatPrice(row.cogs)}
						</p>
					</div>
					<div class="rounded-xl bg-surface-container-low px-3 py-2.5">
						<p class={mobileLabelClass}>Bruta</p>
						<p class="mt-1 font-mono text-[13px] font-semibold text-brand-navy tabular-nums">
							{formatPrice(row.grossProfit)}
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
		<table class="w-full min-w-[78rem] text-left text-sm">
			<thead
				class="sticky top-0 border-b border-slate-200 bg-slate-50 text-[11px] font-semibold tracking-[0.12em] text-slate-500 uppercase"
			>
				<tr>
					<th class="px-4 py-3">Fecha</th>
					<th class="px-4 py-3 text-right">Ventas</th>
					<th class="px-4 py-3 text-right">Ingresos</th>
					<th class="px-4 py-3 text-right">Otros</th>
					<th class="px-4 py-3 text-right">Desc. compras</th>
					<th class="px-4 py-3 text-right">Var. cambiaria</th>
					<th class="px-4 py-3 text-right">Cobrado</th>
					<th class="px-4 py-3 text-right">Costo</th>
					<th class="px-4 py-3 text-right">Util. Bruta</th>
					<th class="px-4 py-3 text-right">Egresos</th>
					<th class="px-4 py-3 text-right">Util. Neta</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200/80">
				{#each daily as row (row.date)}
					<tr class="odd:bg-white even:bg-slate-50/40 hover:bg-slate-50">
						<td class="px-4 py-3">
							{formatDate(row.date, { dateStyle: 'medium' })}
						</td>
						<td class="px-4 py-3 text-right font-mono tabular-nums">{row.salesCount}</td>
						<td class="px-4 py-3 text-right font-mono tabular-nums">{formatPrice(row.revenue)}</td>
						<td
							class="px-4 py-3 text-right font-mono tabular-nums {row.otherIncome > 0
								? 'text-teal-700'
								: 'text-slate-300'}"
						>
							{formatPrice(row.otherIncome)}
						</td>
						<td
							class="px-4 py-3 text-right font-mono tabular-nums {row.purchaseDiscountsEarned > 0
								? 'text-emerald-700'
								: 'text-slate-300'}"
						>
							{formatPrice(row.purchaseDiscountsEarned)}
						</td>
						<td
							class="px-4 py-3 text-right font-mono tabular-nums {row.exchangeSettlementVariance > 0
								? 'text-emerald-700'
								: row.exchangeSettlementVariance < 0
									? 'text-red-700'
									: 'text-slate-300'}"
						>
							{row.exchangeSettlementVariance > 0 ? '+' : ''}{formatPrice(
								row.exchangeSettlementVariance
							)}
						</td>
						<td class="px-4 py-3 text-right font-mono tabular-nums">{formatPrice(row.collected)}</td
						>
						<td class="px-4 py-3 text-right font-mono text-violet-700 tabular-nums"
							>{formatPrice(row.cogs)}</td
						>
						<td class="px-4 py-3 text-right font-mono tabular-nums"
							>{formatPrice(row.grossProfit)}</td
						>
						<td class="px-4 py-3 text-right font-mono text-rose-700 tabular-nums"
							>{formatPrice(row.expenses)}</td
						>
						<td
							class="px-4 py-3 text-right font-mono font-semibold tabular-nums {row.netProfit >= 0
								? 'text-emerald-700'
								: 'text-rose-700'}"
						>
							{formatPrice(row.netProfit)}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="10" class="px-4 py-8 text-center text-slate-400">
							Sin movimientos en el período seleccionado
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>
