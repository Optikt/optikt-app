<script lang="ts">
	import { LineChart } from 'layerchart';
	import { SvelteSet } from 'svelte/reactivity';
	import { cn, formatPrice, formatDateOnly, formatCompactPrice } from '$lib/utils';
	import ChartContainer from '$lib/components/ui/chart/chart-container.svelte';
	import ChartTooltip from '$lib/components/ui/chart/chart-tooltip.svelte';
	import type { ChartConfig } from '$lib/components/ui/chart/chart-utils';

	interface SalesTrendPoint {
		date: string;
		total: number;
		paid: number;
	}

	let {
		points,
		class: className
	}: {
		points: SalesTrendPoint[];
		class?: string;
	} = $props();

	const config = {
		total: { label: 'Vendido', color: 'var(--chart-1)' },
		paid: { label: 'Cobrado', color: 'var(--chart-2)' }
	} satisfies ChartConfig;

	const series = [
		{ key: 'total', label: 'Vendido', value: 'total', color: 'var(--chart-1)' },
		{ key: 'paid', label: 'Cobrado', value: 'paid', color: 'var(--chart-2)' }
	];

	const labelDates = $derived.by(() => {
		const step = Math.max(1, Math.ceil(points.length / 6));
		const dates = new SvelteSet<string>();
		for (let i = 0; i < points.length; i += step) {
			dates.add(points[i].date);
		}
		return dates;
	});

	function formatDay(value: unknown) {
		const iso = String(value);
		if (!labelDates.has(iso)) return '';
		return formatDateOnly(iso, { day: '2-digit', month: '2-digit' });
	}
</script>

<div class={cn('glass-card p-4', className)}>
	<h3 class="mb-3 text-sm font-semibold text-brand-navy">Tendencia diaria</h3>

	{#if points.length === 0}
		<p class="py-8 text-center text-sm text-slate-400">No hay ventas en el período seleccionado</p>
	{:else}
		<ChartContainer {config} class="aspect-auto h-64 w-full">
			<LineChart
				data={points}
				x="date"
				{series}
				axis="x"
				props={{
					xAxis: { format: formatDay },
					yAxis: { format: formatCompactPrice }
				}}
			>
				{#snippet tooltip()}
					<ChartTooltip
						labelKey="date"
						labelFormatter={(value) => formatDateOnly(String(value), { dateStyle: 'medium' })}
						valueFormatter={(value) => formatPrice(Number(value))}
					/>
				{/snippet}
			</LineChart>
		</ChartContainer>
	{/if}
</div>
