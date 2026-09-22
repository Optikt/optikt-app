<script lang="ts">
	import { BarChart } from 'layerchart';
	import { cn, formatPrice, formatCompactPrice } from '$lib/utils';
	import ChartContainer from '$lib/components/ui/chart/chart-container.svelte';
	import ChartTooltip from '$lib/components/ui/chart/chart-tooltip.svelte';
	import type { ChartConfig } from '$lib/components/ui/chart/chart-utils';
	import type { BrandSalesSlice } from '$lib/server/db/queries/reports';

	let {
		slices,
		class: className
	}: {
		slices: BrandSalesSlice[];
		class?: string;
	} = $props();

	const config = {
		total: { label: 'Vendido', color: 'var(--chart-1)' }
	} satisfies ChartConfig;

	const series = [{ key: 'total', label: 'Vendido', value: 'total', color: 'var(--chart-1)' }];

	function truncateLabel(value: unknown) {
		const text = String(value);
		return text.length > 14 ? `${text.slice(0, 13)}…` : text;
	}
</script>

<div class={cn('glass-card p-4', className)}>
	<h3 class="mb-3 text-sm font-semibold text-brand-navy">Monturas y lentes de sol por marca</h3>

	{#if slices.length === 0}
		<p class="py-8 text-center text-sm text-slate-400">
			No hay ventas de monturas o lentes de sol en el período
		</p>
	{:else}
		<ChartContainer {config} class="aspect-auto h-72 w-full">
			<BarChart
				orientation="horizontal"
				data={slices}
				y="brand"
				x="total"
				{series}
				padding={{ left: 96 }}
				props={{
					xAxis: { format: formatCompactPrice },
					yAxis: { format: truncateLabel }
				}}
			>
				{#snippet tooltip()}
					<ChartTooltip labelKey="brand" valueFormatter={(value) => formatPrice(Number(value))} />
				{/snippet}
			</BarChart>
		</ChartContainer>
	{/if}
</div>
