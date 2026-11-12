<script lang="ts">
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { formatPrice } from '$lib/utils';
	import type { SalesStats } from '$lib/server/db/queries/sales/types';

	type KpiId = 'receivable' | 'month' | 'ready';

	interface Props {
		stats: SalesStats;
		onSelect: (kpi: KpiId) => void;
	}

	let { stats, onSelect }: Props = $props();

	const cardBase =
		'relative flex flex-col gap-0.5 rounded-[var(--ds-radius-lg)] border-0 p-3.5 text-left shadow-[var(--ds-shadow-sm)] transition-transform duration-200 ease-out hover:-translate-y-px';
</script>

<div class="grid grid-cols-1 gap-3 md:grid-cols-[1.35fr_1fr_1fr]">
	<TriggerTooltip text="Filtra las ventas con saldo y las ordena de mayor a menor saldo">
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				onclick={() => onSelect('receivable')}
				class="{cardBase} bg-brand-navy"
			>
				<span class="text-[11px] font-bold tracking-[0.08em] text-white/70 uppercase">
					Por cobrar
				</span>
				<span class="font-heading text-[30px] leading-tight font-bold text-brand-gold">
					{formatPrice(stats.receivableAmount)}
				</span>
				<span class="text-xs text-white/70">en {stats.receivableCount} ventas con saldo</span>
			</button>
		{/snippet}
	</TriggerTooltip>

	<TriggerTooltip text="Ventas creadas este mes (sin canceladas)">
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				onclick={() => onSelect('month')}
				class="{cardBase} bg-white"
			>
				<span class="text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
					Ventas del mes
				</span>
				<span class="font-heading text-[26px] leading-tight font-bold text-brand-navy">
					{stats.monthly}
				</span>
				<span class="text-xs text-on-surface-variant">
					{formatPrice(stats.monthlyTotalUsd)} vendidos
				</span>
			</button>
		{/snippet}
	</TriggerTooltip>

	<TriggerTooltip text="Ventas listas para entregar al cliente">
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				onclick={() => onSelect('ready')}
				class="{cardBase} bg-white"
			>
				<span class="text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
					Listas para retirar
				</span>
				<span class="font-heading text-[26px] leading-tight font-bold text-brand-navy">
					{stats.ready}
				</span>
				<span class="text-xs text-on-surface-variant">por entregar</span>
			</button>
		{/snippet}
	</TriggerTooltip>
</div>
