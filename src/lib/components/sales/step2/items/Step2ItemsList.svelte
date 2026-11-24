<script lang="ts">
	import { Search } from '@lucide/svelte';
	import { autoAnimate } from '@formkit/auto-animate';
	import type { SupplierTreatment } from '$lib/server/db/schema';
	import type { PrescriptionFieldErrors } from '../../saleItemHelpers';
	import { getEnabledEyeCount } from '../../saleItemHelpers';
	import type { SaleItemRow } from '../../newSaleTypes';
	import type { Snippet } from 'svelte';
	import SaleStep2ItemCard from '../SaleStep2ItemCard.svelte';

	interface Props {
		items: SaleItemRow[];
		itemTreatmentsMap: Record<string, SupplierTreatment[]>;
		lensTreatmentInfo: Record<string, { name: string; total: number } | null>;
		rxErrorsPerLens: Record<string, PrescriptionFieldErrors>;
		onRemoveItem: (id: string) => void;
		onQuantityChange?: (id: string, quantity: number) => void;
		onRemoveTreatment: (treatmentItemId: string) => void;
		onOpenTreatment: (lensItemId: string) => void;
		/** Per-person chip for groupable lines (sale/quote wizard). */
		personChip?: Snippet<[SaleItemRow]>;
	}

	let {
		items,
		itemTreatmentsMap,
		lensTreatmentInfo,
		rxErrorsPerLens,
		onRemoveItem,
		onQuantityChange,
		onRemoveTreatment,
		onOpenTreatment,
		personChip
	}: Props = $props();
</script>

<div>
	<div class="space-y-1" use:autoAnimate>
		{#if items.length === 0}
			<div
				class="flex flex-col items-center justify-center rounded-lg border border-dashed border-outline-variant/40 bg-surface-container-lowest px-4 py-8 text-center"
			>
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue"
				>
					<Search class="h-4 w-4" />
				</div>
				<h4 class="mt-3 text-sm font-semibold text-brand-navy">
					Agrega el primer artículo desde la búsqueda
				</h4>
			</div>
		{:else}
			{#each items as item, _index (item.id)}
				{#if item.kind === 'treatment'}
					<div class="ml-4 border-l-2 border-slate-200 pl-3">
						<SaleStep2ItemCard
							{item}
							onremove={() => onRemoveTreatment(item.id)}
							eyeCount={0}
							isIncludedAccessory={false}
							availableTreatments={[]}
							currentTreatmentName={item.treatmentName}
							onopenTreatment={itemTreatmentsMap[item.parentLensItemId]?.length > 0
								? () => onOpenTreatment(item.parentLensItemId)
								: undefined}
						/>
					</div>
				{:else}
					{@const ti = item.kind === 'lens' ? (lensTreatmentInfo[item.id] ?? null) : null}
					<SaleStep2ItemCard
						{item}
						rxErrs={item.kind === 'lens' ? (rxErrorsPerLens[item.id] ?? {}) : {}}
						onremove={() => onRemoveItem(item.id)}
						onquantitychange={(qty) => onQuantityChange?.(item.id, qty)}
						eyeCount={item.kind === 'lens' ? getEnabledEyeCount(item) : 0}
						isIncludedAccessory={item.isIncludedAccessory}
						availableTreatments={itemTreatmentsMap[item.id] ?? []}
						currentTreatmentName={ti?.name ?? null}
						onopenTreatment={item.kind === 'lens' && itemTreatmentsMap[item.id]?.length > 0
							? () => onOpenTreatment(item.id)
							: undefined}
					>
						{#snippet person()}
							{@render personChip?.(item)}
						{/snippet}
					</SaleStep2ItemCard>
				{/if}
			{/each}
		{/if}
	</div>
</div>
