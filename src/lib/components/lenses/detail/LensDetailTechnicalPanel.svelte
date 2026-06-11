<script lang="ts">
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { AppBadge, TreatmentBadge } from '$lib/components/ui';
	import {
		getPriceTypeLabel,
	} from '$lib/shared/enums';
	import { getLensInventorySummary } from './helpers';

	interface Props {
		item: LensCatalogItemWithRelations;
	}

	let { item }: Props = $props();

	const inventorySummary = $derived(getLensInventorySummary(item.inventoryMode, item.stock));
	const hasTreatments = $derived(item.hasAr || item.hasBluecut || item.isPhotochromic);
	const refractiveIndexLabel = $derived(
		item.material?.refractiveIndex != null ? item.material.refractiveIndex.toFixed(2) : '-'
	);
</script>

<section class="rounded-[1.75rem] bg-white px-6 py-6 shadow-sm sm:px-7 border border-surface-container-high">
    <h2 class="text-xs font-semibold tracking-[0.16em] text-outline uppercase mb-4">Propiedades técnicas</h2>

	<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <div>
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Proveedor</p>
			<p class="mt-1 text-sm font-bold text-brand-navy">
				{item.supplier?.name ?? '-'}
			</p>
		</div>
        <div>
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Material</p>
			<p class="mt-1 text-sm font-bold text-brand-navy">
				{item.material?.name ?? '-'}
			</p>
		</div>
        <div>
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Tecnología</p>
			<p class="mt-1 text-sm font-bold text-brand-navy">
				{item.technology ?? '-'}
			</p>
		</div>
        <div>
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Índice</p>
			<p class="mt-1 text-sm font-bold text-brand-navy">
				{refractiveIndexLabel}
			</p>
		</div>
        <div>
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Inventario</p>
			<p class="mt-1 text-sm font-bold text-brand-navy">
                {inventorySummary}
			</p>
		</div>
        <div>
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Tipo de precio</p>
			<p class="mt-1 text-sm font-bold text-brand-navy">
                {getPriceTypeLabel(item.priceType)}
			</p>
		</div>
	</div>

	<div class="mt-6 pt-6 border-t border-surface-container-high">
		<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase mb-2">Tratamientos</p>
		<div class="flex flex-wrap gap-2">
			{#if item.hasAr}
				<TreatmentBadge type="antiReflective" />
			{/if}
			{#if item.hasBluecut}
				<TreatmentBadge type="blueBlock" />
			{/if}
			{#if item.isPhotochromic}
				<TreatmentBadge type="photochromic" />
			{/if}
			{#if !hasTreatments}
				<AppBadge variant="neutral">Ninguno</AppBadge>
			{/if}
		</div>
	</div>
</section>
