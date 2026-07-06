<script lang="ts">
	import { Copy, PackagePlus } from '@lucide/svelte';

	type QuickAddFilter = 'all' | 'product' | 'lens';

	interface Props {
		filter: QuickAddFilter;
		onfilterchange: (f: QuickAddFilter) => void;
		onaddfree: () => void;
		oncopyrx: () => void;
		canCopyRxToAll?: boolean;
	}

	let { filter, onfilterchange, onaddfree, oncopyrx, canCopyRxToAll = false }: Props = $props();

	const quickAddFilterOptions: { value: QuickAddFilter; label: string }[] = [
		{ value: 'all', label: 'Todo' },
		{ value: 'product', label: 'Productos' },
		{ value: 'lens', label: 'Lentes' }
	];

	const activeFilterIdx = $derived(quickAddFilterOptions.findIndex((o) => o.value === filter));
</script>

<div class="inline-flex items-center gap-1">
	<div
		class="relative inline-grid overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
		style="grid-template-columns: repeat({quickAddFilterOptions.length}, 1fr)"
	>
		<div
			class="absolute top-1 bottom-1 left-1 rounded-md bg-brand-navy shadow-sm transition-transform duration-200 ease-out"
			style="width: calc((100% - 0.5rem) / {quickAddFilterOptions.length}); transform: translateX(calc({activeFilterIdx} * 100%))"
		></div>
		{#each quickAddFilterOptions as option (option.value)}
			<button
				type="button"
				onclick={() => onfilterchange(option.value)}
				class="relative z-10 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors duration-200 {filter ===
				option.value
					? 'text-white'
					: 'text-slate-600 hover:text-slate-800'}"
			>
				{option.label}
			</button>
		{/each}
	</div>

	<button
		type="button"
		onclick={onaddfree}
		class="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
	>
		<PackagePlus class="h-3.5 w-3.5" />
		Ítem Libre
	</button>

	{#if canCopyRxToAll}
		<button
			type="button"
			onclick={oncopyrx}
			class="inline-flex items-center gap-1.5 rounded-lg border border-brand-blue/30 bg-brand-blue/5 px-3 py-1.5 text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue/10"
		>
			<Copy class="h-3.5 w-3.5" />
			Copiar Rx a todos
		</button>
	{/if}
</div>
