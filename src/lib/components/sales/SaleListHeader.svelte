<script lang="ts">
	import { Plus, List, LayoutGrid } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SegmentedToggle from '$lib/components/ui/SegmentedToggle.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import type { SaleListView } from './listParams';

	interface Props {
		totalCount: number;
		view: SaleListView;
		canCreate: boolean;
		onViewChange: (view: SaleListView) => void;
	}

	let { totalCount, view, canCreate, onViewChange }: Props = $props();

	const viewOptions = [
		{ value: 'list', label: 'Lista', icon: List },
		{ value: 'grid', label: 'Cuadros', icon: LayoutGrid }
	];
</script>

<div class="flex flex-wrap items-center gap-3">
	<div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
		<h1 class="font-heading text-[28px] leading-none font-bold text-brand-navy">Ventas</h1>
		<p class="text-[13px] text-on-surface-variant">
			{totalCount}
			{totalCount === 1 ? 'venta registrada' : 'ventas registradas'}
		</p>
	</div>

	<TriggerTooltip text="Vista de lista o cuadros" side="bottom">
		{#snippet trigger({ props })}
			<div {...props}>
				<SegmentedToggle
					value={view}
					options={viewOptions}
					variant="light"
					class="w-auto"
					onchange={(v) => onViewChange(v as SaleListView)}
				/>
			</div>
		{/snippet}
	</TriggerTooltip>

	{#if canCreate}
		<button
			type="button"
			onclick={() => void goto(resolve('/sales/new'))}
			class="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-lg bg-brand-gold px-4 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md"
		>
			<Plus size={16} />
			Nueva venta
		</button>
	{/if}
</div>
