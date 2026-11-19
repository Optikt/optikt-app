<script lang="ts">
	import { Plus, List, LayoutGrid } from '@lucide/svelte';
	import SegmentedToggle from '$lib/components/ui/SegmentedToggle.svelte';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';
	import type { SaleListView } from './listParams';

	interface Props {
		totalCount: number;
		view: SaleListView;
		canCreate: boolean;
		onViewChange: (view: SaleListView) => void;
		/** Generalización compartida con quotes (mismo lenguaje visual). */
		title?: string;
		/** Unidad del contador, singular y plural ("venta registrada"/"ventas registradas"). */
		countNounOne?: string;
		countNounMany?: string;
		createLabel?: string;
		/** Acción del CTA (el caller navega con resolve(): regla no-navigation-without-resolve). */
		onCreate?: () => void;
		showViewToggle?: boolean;
		/** Móvil: título 26, selector solo iconos y «Nueva venta» fuera (va al FAB). */
		narrow?: boolean;
	}

	let {
		totalCount,
		view,
		canCreate,
		onViewChange,
		title = 'Ventas',
		countNounOne = 'venta registrada',
		countNounMany = 'ventas registradas',
		createLabel = 'Nueva venta',
		onCreate,
		showViewToggle = true,
		narrow = false
	}: Props = $props();

	const viewOptions = [
		{ value: 'list', label: 'Lista', icon: List },
		{ value: 'grid', label: 'Cuadros', icon: LayoutGrid }
	];
</script>

<div class="flex flex-wrap items-center gap-3">
	<div class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-0.5">
		<h1
			class="font-heading leading-none font-bold text-brand-navy {narrow
				? 'text-[26px]'
				: 'text-[28px]'}"
		>
			{title}
		</h1>
		<p class="{narrow ? 'text-[12px]' : 'text-[13px]'} text-on-surface-variant">
			{totalCount}
			{totalCount === 1 ? countNounOne : countNounMany}
		</p>
	</div>

	{#if showViewToggle}
		<TriggerTooltip text="Vista de lista o cuadros" side="bottom">
			{#snippet trigger({ props })}
				<div {...props}>
					<SegmentedToggle
						value={view}
						options={viewOptions}
						variant="light"
						iconOnly={narrow}
						class="w-auto"
						onchange={(v) => onViewChange(v as SaleListView)}
					/>
				</div>
			{/snippet}
		</TriggerTooltip>
	{/if}

	{#if canCreate && !narrow}
		<button
			type="button"
			onclick={() => onCreate?.()}
			class="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-lg bg-brand-gold px-4 text-sm font-bold text-brand-navy shadow-sm transition-all hover:bg-brand-gold-dark hover:shadow-md"
		>
			<Plus size={16} />
			{createLabel}
		</button>
	{/if}
</div>
