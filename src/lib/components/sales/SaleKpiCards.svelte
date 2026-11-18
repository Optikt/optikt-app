<script lang="ts">
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import Carousel from '$lib/components/ui/Carousel.svelte';
	import { formatPrice } from '$lib/utils';
	import type { SalesStats } from '$lib/server/db/queries/sales/types';

	type KpiId = 'receivable' | 'month' | 'ready';

	interface Props {
		stats: SalesStats;
		onSelect: (kpi: KpiId) => void;
		/** Móvil: carrusel horizontal con scroll-snap e indicador (mockup §3.2). */
		narrow?: boolean;
	}

	let { stats, onSelect, narrow = false }: Props = $props();

	const KPIS: { id: KpiId; label: string; tooltip: string }[] = [
		{
			id: 'receivable',
			label: 'Por cobrar',
			tooltip: 'Filtra las ventas con saldo y las ordena de mayor a menor saldo'
		},
		{ id: 'month', label: 'Ventas del mes', tooltip: 'Ventas creadas este mes (sin canceladas)' },
		{ id: 'ready', label: 'Listas para retirar', tooltip: 'Ventas listas para entregar al cliente' }
	];

	function kpiLabel(kpi: KpiId): string {
		return KPIS.find((k) => k.id === kpi)?.label ?? '';
	}

	function kpiTooltip(kpi: KpiId): string {
		return KPIS.find((k) => k.id === kpi)?.tooltip ?? '';
	}

	function kpiValue(kpi: KpiId): string {
		if (kpi === 'receivable') return formatPrice(stats.receivableAmount);
		if (kpi === 'month') return String(stats.monthly);
		return String(stats.ready);
	}

	function kpiSub(kpi: KpiId): string {
		if (kpi === 'receivable') return `en ${stats.receivableCount} ventas con saldo`;
		if (kpi === 'month') return `${formatPrice(stats.monthlyTotalUsd)} vendidos`;
		return 'por entregar';
	}
</script>

{#snippet kpiCard(kpi: KpiId, compact: boolean)}
	{@const isReceivable = kpi === 'receivable'}
	{@const cardBase = compact
		? 'relative flex h-[84px] flex-col justify-center gap-0.5 rounded-[var(--ds-radius-lg)] border-0 p-3.5 text-left shadow-[var(--ds-shadow-sm)] transition-transform duration-200 ease-out active:scale-[0.98]'
		: 'relative flex flex-col gap-0.5 rounded-[var(--ds-radius-lg)] border-0 p-3.5 text-left shadow-[var(--ds-shadow-sm)] transition-transform duration-200 ease-out hover:-translate-y-px'}
	<TriggerTooltip text={kpiTooltip(kpi)}>
		{#snippet trigger({ props })}
			<button
				{...props}
				type="button"
				onclick={() => onSelect(kpi)}
				class="{cardBase} {isReceivable ? 'bg-brand-navy' : 'bg-white'}"
			>
				<span
					class="text-[11px] font-bold tracking-[0.08em] uppercase {isReceivable
						? 'text-white/70'
						: 'text-on-surface-variant'}"
				>
					{kpiLabel(kpi)}
				</span>
				<span
					class="font-heading leading-tight font-bold {isReceivable
						? 'text-brand-gold'
						: 'text-brand-navy'} {compact
						? isReceivable
							? 'text-[28px]'
							: 'text-[24px]'
						: isReceivable
							? 'text-[30px]'
							: 'text-[26px]'}"
				>
					{kpiValue(kpi)}
				</span>
				<span class="text-xs {isReceivable ? 'text-white/70' : 'text-on-surface-variant'}">
					{kpiSub(kpi)}
				</span>
			</button>
		{/snippet}
	</TriggerTooltip>
{/snippet}

{#if narrow}
	<!-- Carrusel: 232 px por tarjeta, la tercera asoma para invitar a deslizar. -->
	<Carousel
		items={KPIS.map((k) => k.id)}
		itemWidthPx={232}
		gapPx={10}
		edgePx={12}
		ariaLabel="Resumen de ventas"
	>
		{#snippet item(kpi, _index)}
			{@render kpiCard(kpi as KpiId, true)}
		{/snippet}
	</Carousel>
{:else}
	<div class="grid grid-cols-1 gap-3 md:grid-cols-[1.35fr_1fr_1fr]">
		{@render kpiCard('receivable', false)}
		{@render kpiCard('month', false)}
		{@render kpiCard('ready', false)}
	</div>
{/if}
