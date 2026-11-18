<script lang="ts">
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import { formatPrice } from '$lib/utils';
	import type { QuoteStats } from '$lib/server/db/queries/quotes';

	type KpiId = 'open' | 'month' | 'converted';

	interface Props {
		stats: QuoteStats;
		onSelect: (kpi: KpiId) => void;
	}

	let { stats, onSelect }: Props = $props();

	const cardBase =
		'relative flex flex-col gap-0.5 rounded-[var(--ds-radius-lg)] border-0 p-3.5 text-left shadow-[var(--ds-shadow-sm)] transition-transform duration-200 ease-out hover:-translate-y-px';

	/** Tasa = convertidos del mes / creados del mes (documentada en quotes.md). */
	const conversionRate = $derived(
		stats.monthly > 0 ? Math.round((stats.monthlyConverted / stats.monthly) * 100) : null
	);
</script>

<div class="grid grid-cols-2 gap-3 md:grid-cols-[1.35fr_1fr_1fr]">
	<TriggerTooltip text="Filtra los borradores y los ordena de mayor a menor total">
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				onclick={() => onSelect('open')}
				class="{cardBase} col-span-2 bg-brand-navy md:col-span-1"
			>
				<span class="text-[11px] font-bold tracking-[0.08em] text-white/70 uppercase">
					Abiertos
				</span>
				<span class="font-heading text-[30px] leading-tight font-bold text-brand-gold">
					{formatPrice(stats.openTotal)}
				</span>
				<span class="text-xs text-white/70">en {stats.open} presupuestos por convertir</span>
			</button>
		{/snippet}
	</TriggerTooltip>

	<TriggerTooltip text="Presupuestos creados este mes (sin cancelados)">
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				onclick={() => onSelect('month')}
				class="{cardBase} bg-white"
			>
				<span class="text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
					Presupuestos del mes
				</span>
				<span class="font-heading text-[26px] leading-tight font-bold text-brand-navy">
					{stats.monthly}
				</span>
				<span class="text-xs text-on-surface-variant">
					{formatPrice(stats.monthlyTotal)} presupuestados
				</span>
			</button>
		{/snippet}
	</TriggerTooltip>

	<TriggerTooltip text="Presupuestos convertidos a venta este mes">
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				onclick={() => onSelect('converted')}
				class="{cardBase} bg-white"
			>
				<span class="text-[11px] font-bold tracking-[0.08em] text-on-surface-variant uppercase">
					Convertidos del mes
				</span>
				<span class="font-heading text-[26px] leading-tight font-bold text-brand-navy">
					{stats.monthlyConverted}
				</span>
				<span class="text-xs text-on-surface-variant">
					{#if conversionRate !== null}
						<span class="font-semibold text-success">{conversionRate}%</span>
						de conversión
					{:else}
						de conversión
					{/if}
				</span>
			</button>
		{/snippet}
	</TriggerTooltip>
</div>
