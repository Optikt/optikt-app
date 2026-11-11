<script lang="ts">
	import { TriangleAlert } from '@lucide/svelte';
	import type { SaleItemWithDetails } from '$lib/server/db/queries/sales/types';
	import { formatAxis, formatOpticalValue } from '$lib/utils';
	import { isProgressiveItem } from './itemDisplay';
	import TriggerTooltip from '$lib/components/ui/TriggerTooltip.svelte';

	interface Props {
		item: SaleItemWithDetails;
	}

	let { item }: Props = $props();

	/**
	 * Expanded prescription table (mockup Opción B).
	 *
	 * ALT / DP / DNP are NOT persisted on sale items yet (prompt §13.5): the
	 * measures block renders for progressive/bifocal lenses with faded "—"
	 * values and the amber warning until the data exists.
	 */
	const progressive = $derived(isProgressiveItem(item));
	const showMeasures = $derived(progressive);
	const missingMeasures = $derived(progressive);

	const COLS_BASE = 'grid-cols-[30px_repeat(4,56px)]';
	const COLS_MEASURES = 'grid-cols-[30px_repeat(4,56px)_14px_repeat(3,50px)]';

	interface EyeValues {
		sphere: number | null | undefined;
		cylinder: number | null | undefined;
		axis: number | null | undefined;
		addition: number | null | undefined;
	}

	const od = $derived<EyeValues>({
		sphere: item.odSphere,
		cylinder: item.odCylinder,
		axis: item.odAxis,
		addition: item.odAddition
	});
	const os = $derived<EyeValues>({
		sphere: item.osSphere,
		cylinder: item.osCylinder,
		axis: item.osAxis,
		addition: item.osAddition
	});

	function optical(value: number | null | undefined): string | null {
		return value == null ? null : formatOpticalValue(value);
	}
	function axis(value: number | null | undefined): string | null {
		return value == null ? null : formatAxis(value);
	}
</script>

{#snippet measureWarn({ props }: { props: Record<string, unknown> })}
	<div
		{...props}
		class="mt-2 flex cursor-help items-center gap-1.5 text-xs font-semibold text-on-warning-container"
	>
		<TriangleAlert class="h-3.5 w-3.5 shrink-0" />
		Faltan medidas de montaje (ALT, DNP)
	</div>
{/snippet}

<div class="mr-4 mb-3 ml-[60px] rounded-lg bg-surface-container-low px-3 py-2.5">
	<div class="mb-2 flex items-center gap-2">
		<span class="grid h-5 w-5 place-items-center rounded bg-surface-container-high">
			<svg
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				class="h-3 w-3 text-on-surface-variant"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
				/></svg
			>
		</span>
		<span class="text-xs font-bold tracking-[0.1em] text-on-surface-variant uppercase">
			Prescripción
		</span>
	</div>

	<div
		class="grid w-max items-center gap-x-1 gap-y-1 text-[13px] {showMeasures
			? COLS_MEASURES
			: COLS_BASE}"
	>
		<!-- Header -->
		<span></span>
		<span class="text-right text-[10px] font-bold tracking-[0.08em] text-on-surface-variant"
			>ESF</span
		>
		<span class="text-right text-[10px] font-bold tracking-[0.08em] text-on-surface-variant"
			>CIL</span
		>
		<span class="text-right text-[10px] font-bold tracking-[0.08em] text-on-surface-variant"
			>EJE</span
		>
		<span class="text-right text-[10px] font-bold tracking-[0.08em] text-on-surface-variant"
			>ADD</span
		>
		{#if showMeasures}
			<span class="h-4 w-px justify-self-center bg-outline-variant"></span>
			<span class="text-right text-[10px] font-bold tracking-[0.08em] text-on-surface-variant"
				>ALT</span
			>
			<span class="text-right text-[10px] font-bold tracking-[0.08em] text-on-surface-variant"
				>DP</span
			>
			<span class="text-right text-[10px] font-bold tracking-[0.08em] text-on-surface-variant"
				>DNP</span
			>
		{/if}

		<!-- OD -->
		<span class="flex items-center gap-1.5 text-xs font-bold text-on-surface">
			<span class="h-[7px] w-[7px] rounded-full bg-brand-blue"></span>OD
		</span>
		<span class="text-right font-medium tabular-nums">{optical(od.sphere) ?? '—'}</span>
		<span class="text-right font-medium tabular-nums">{optical(od.cylinder) ?? '—'}</span>
		<span class="text-right font-medium tabular-nums">{axis(od.axis) ?? '—'}</span>
		<span class="text-right font-medium tabular-nums">{optical(od.addition) ?? '—'}</span>
		{#if showMeasures}
			<span class="h-4 w-px justify-self-center bg-outline-variant"></span>
			<span class="text-right font-medium text-on-surface-variant/60 tabular-nums">—</span>
			<span class="text-right font-medium text-on-surface-variant/60 tabular-nums">—</span>
			<span class="text-right font-medium text-on-surface-variant/60 tabular-nums">—</span>
		{/if}

		<!-- OI -->
		<span class="flex items-center gap-1.5 text-xs font-bold text-on-surface">
			<span class="h-[7px] w-[7px] rounded-full bg-brand-navy"></span>OI
		</span>
		<span class="text-right font-medium tabular-nums">{optical(os.sphere) ?? '—'}</span>
		<span class="text-right font-medium tabular-nums">{optical(os.cylinder) ?? '—'}</span>
		<span class="text-right font-medium tabular-nums">{axis(os.axis) ?? '—'}</span>
		<span class="text-right font-medium tabular-nums">{optical(os.addition) ?? '—'}</span>
		{#if showMeasures}
			<span class="h-4 w-px justify-self-center bg-outline-variant"></span>
			<span class="text-right font-medium text-on-surface-variant/60 tabular-nums">—</span>
			<span class="text-right font-medium text-on-surface-variant/60 tabular-nums">—</span>
			<span class="text-right font-medium text-on-surface-variant/60 tabular-nums">—</span>
		{/if}
	</div>

	{#if missingMeasures}
		<TriggerTooltip
			trigger={measureWarn}
			text="Los progresivos y bifocales necesitan Altura y DNP para el montaje."
		/>
	{/if}
</div>
