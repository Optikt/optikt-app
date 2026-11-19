<script lang="ts">
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import Carousel from '$lib/components/ui/Carousel.svelte';
	import { formatPrice } from '$lib/utils';
	import type { QuoteStats } from '$lib/server/db/queries/quotes/types';

	type KpiId = 'open' | 'month' | 'converted';

	interface Props {
		stats: QuoteStats;
		onSelect: (kpi: KpiId) => void;
		/** Móvil: carrusel horizontal con scroll-snap e indicador (igual que ventas). */
		narrow?: boolean;
	}

	let { stats, onSelect, narrow = false }: Props = $props();

	const KPIS: { id: KpiId; label: string; tooltip: string }[] = [
		{
			id: 'open',
			label: 'Abiertos',
			tooltip: 'Filtra los borradores y los ordena de mayor a menor total'
		},
		{
			id: 'month',
			label: 'Presupuestos del mes',
			tooltip: 'Presupuestos creados este mes (sin cancelados)'
		},
		{
			id: 'converted',
			label: 'Convertidos del mes',
			tooltip: 'Presupuestos convertidos a venta este mes'
		}
	];

	/** Tasa = convertidos del mes / creados del mes (documentada en quotes.md). */
	const conversionRate = $derived(
		stats.monthly > 0 ? Math.round((stats.monthlyConverted / stats.monthly) * 100) : null
	);

	function kpiValue(kpi: KpiId): string {
		if (kpi === 'open') return formatPrice(stats.openTotal);
		if (kpi === 'month') return String(stats.monthly);
		return String(stats.monthlyConverted);
	}
</script>

{#snippet kpiCard(kpi: (typeof KPIS)[number], compact: boolean)}
	{@const isOpen = kpi.id === 'open'}
	{@const cardBase = compact
		? 'relative flex h-[84px] w-full flex-col justify-center gap-0.5 rounded-[var(--ds-radius-lg)] border-0 p-3.5 text-left shadow-[var(--ds-shadow-sm)] transition-transform duration-200 ease-out active:scale-[0.98]'
		: 'relative flex flex-col gap-0.5 rounded-[var(--ds-radius-lg)] border-0 p-3.5 text-left shadow-[var(--ds-shadow-sm)] transition-transform duration-200 ease-out hover:-translate-y-px'}
	<TriggerTooltip text={kpi.tooltip}>
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				onclick={() => onSelect(kpi.id)}
				class="{cardBase} {isOpen ? 'bg-brand-navy' : 'bg-white'}"
			>
				<span
					class="text-[11px] font-bold tracking-[0.08em] uppercase {isOpen
						? 'text-white/70'
						: 'text-on-surface-variant'}"
				>
					{kpi.label}
				</span>
				<span
					class="font-heading leading-tight font-bold {isOpen
						? 'text-brand-gold'
						: 'text-brand-navy'} {compact
						? isOpen
							? 'text-[28px]'
							: 'text-[24px]'
						: isOpen
							? 'text-[30px]'
							: 'text-[26px]'}"
				>
					{kpiValue(kpi.id)}
				</span>
				<span class="text-xs {isOpen ? 'text-white/70' : 'text-on-surface-variant'}">
					{#if kpi.id === 'open'}
						{compact
							? `${stats.open} por convertir`
							: `en ${stats.open} presupuestos por convertir`}
					{:else if kpi.id === 'month'}
						{formatPrice(stats.monthlyTotal)} presupuestados
					{:else}
						{#if conversionRate !== null}
							<span class="font-semibold text-success">{conversionRate}%</span>
						{/if}
						de conversión
					{/if}
				</span>
			</button>
		{/snippet}
	</TriggerTooltip>
{/snippet}

{#if narrow}
	<!-- Carrusel: 232 px por tarjeta, la tercera asoma para invitar a deslizar. -->
	<Carousel
		items={KPIS}
		itemWidthPx={232}
		gapPx={10}
		edgePx={12}
		ariaLabel="Resumen de presupuestos"
	>
		{#snippet item(kpi, _index)}
			{@render kpiCard(kpi, true)}
		{/snippet}
	</Carousel>
{:else}
	<div class="grid grid-cols-1 gap-3 md:grid-cols-[1.35fr_1fr_1fr]">
		{#each KPIS as kpi (kpi.id)}
			{@render kpiCard(kpi, false)}
		{/each}
	</div>
{/if}
