<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildrenOrChild } from '$lib/utils';
	import type { HTMLAttributes } from 'svelte/elements';
	import { getChartContext, Tooltip as TooltipPrimitive } from 'layerchart';
	import type { TooltipSeries } from 'layerchart';
	import { getPayloadConfigFromPayload, useChart } from './chart-utils';

	function defaultValueFormatter(value: unknown) {
		return typeof value === 'number' ? value.toLocaleString('es-VE') : String(value);
	}

	let {
		ref = $bindable(null),
		class: className,
		hideLabel = false,
		indicator = 'dot',
		hideIndicator = false,
		labelKey,
		label,
		labelFormatter,
		labelClassName,
		valueFormatter = defaultValueFormatter,
		nameKey,
		color,
		extraRows,
		...restProps
	}: WithoutChildrenOrChild<WithElementRef<HTMLAttributes<HTMLDivElement>>> & {
		hideLabel?: boolean;
		label?: string;
		indicator?: 'line' | 'dot' | 'dashed';
		nameKey?: string;
		labelKey?: string;
		hideIndicator?: boolean;
		labelClassName?: string;
		labelFormatter?: (value: unknown) => string;
		valueFormatter?: (value: unknown) => string;
		extraRows?: (datum: Record<string, unknown>) => { label: string; value: string }[];
	} = $props();

	const chart = useChart();
	const tooltip = getChartContext().tooltip;

	const rows = $derived(tooltip.series.filter((series) => series.visible));
	const datum = $derived(tooltip.data as Record<string, unknown> | null);
	const extras = $derived(extraRows && datum ? extraRows(datum) : []);

	const formattedLabel = $derived.by(() => {
		if (hideLabel) return null;
		if (typeof label === 'string') return label;
		if (!labelKey) return null;

		const raw = datum?.[labelKey];
		if (raw === undefined || raw === null) return null;

		return labelFormatter ? labelFormatter(raw) : String(raw);
	});

	function rowName(row: TooltipSeries) {
		const raw = nameKey ? datum?.[nameKey] : undefined;
		return typeof raw === 'string' ? raw : row.label;
	}
</script>

<TooltipPrimitive.Root variant="none">
	<div
		bind:this={ref}
		class={cn(
			'grid min-w-[9rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl',
			className
		)}
		{...restProps}
	>
		{#if formattedLabel}
			<div class={cn('font-medium', labelClassName)}>{formattedLabel}</div>
		{/if}
		<div class="grid gap-1.5">
			{#each rows as row (row.key)}
				{@const itemConfig = getPayloadConfigFromPayload(chart.config, row, nameKey ?? row.key)}
				{@const indicatorColor = color ?? row.color}
				<div
					class={cn(
						'flex w-full flex-wrap items-center gap-2 [&>svg]:size-2.5',
						indicator === 'dot' && 'items-center'
					)}
				>
					{#if !hideIndicator}
						<div
							style="--color-bg: {indicatorColor}; --color-border: {indicatorColor};"
							class={cn('shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)', {
								'size-2.5': indicator === 'dot',
								'h-full w-1': indicator === 'line',
								'w-0 border-[1.5px] border-dashed bg-transparent': indicator === 'dashed'
							})}
						></div>
					{/if}
					<div class="flex flex-1 shrink-0 items-center justify-between leading-none">
						<span class="text-muted-foreground">{itemConfig?.label || rowName(row)}</span>
						{#if row.value !== undefined}
							<span class="font-mono font-medium text-foreground tabular-nums">
								{valueFormatter(row.value)}
							</span>
						{/if}
					</div>
				</div>
			{/each}
			{#each extras as extra (extra.label)}
				<div class="flex w-full items-center justify-between gap-2 leading-none">
					<span class="text-muted-foreground">{extra.label}</span>
					<span class="font-mono font-medium text-foreground tabular-nums">{extra.value}</span>
				</div>
			{/each}
		</div>
	</div>
</TooltipPrimitive.Root>
