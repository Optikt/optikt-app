<script lang="ts">
	import { Factory, Warehouse, Eye, CircleCheck, CircleX, Clock, Package } from '@lucide/svelte';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import {
		getInventoryModeLabel,
		getLensSourceLabel,
		getLensTypeLabel,
		getLensTypeBadgeColor,
		LensCatalogSource
	} from '$lib/shared/enums';
	import { AppBadge, TreatmentBadge } from '$lib/components/ui';
	import {
		getLensInventorySummary,
		getLensInventoryVariant,
		getLensSourceVariant
	} from './helpers';

	interface Props {
		item: LensCatalogItemWithRelations;
	}

	let { item }: Props = $props();

	const inventorySummary = $derived(getLensInventorySummary(item.inventoryMode, item.stock));
	const hasTreatments = $derived(item.hasAr || item.hasBluecut || item.isPhotochromic);
	const refractiveIndexLabel = $derived(
		item.material?.refractiveIndex != null ? item.material.refractiveIndex.toFixed(2) : 'Sin índice'
	);
	const SourceIcon = $derived(item.source === LensCatalogSource.LAB ? Factory : Warehouse);
	const InventoryIcon = $derived(item.inventoryMode === 'ON_DEMAND' ? Clock : Package);
</script>

<section class="rounded-[1.75rem] bg-surface-container-lowest px-6 py-6 shadow-sm sm:px-7">
	<div class="flex flex-wrap gap-2">
		<AppBadge variant={getLensSourceVariant(item.source)}>
			<SourceIcon class="mr-1 h-3 w-3" />
			{getLensSourceLabel(item.source)}
		</AppBadge>
		<AppBadge variant={getLensTypeBadgeColor(item.type)}>
			<Eye class="mr-1 h-3 w-3" />
			{getLensTypeLabel(item.type)}
		</AppBadge>
		<AppBadge variant={item.isActive ? 'success' : 'neutral'}>
			{#if item.isActive}
				<CircleCheck class="mr-1 h-3 w-3" />
			{:else}
				<CircleX class="mr-1 h-3 w-3" />
			{/if}
			{item.isActive ? 'Activo' : 'Inactivo'}
		</AppBadge>
		<AppBadge variant={getLensInventoryVariant(item.inventoryMode, item.stock)}>
			<InventoryIcon class="mr-1 h-3 w-3" />
			{inventorySummary}
		</AppBadge>
	</div>

	<div class="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
		<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Proveedor</p>
			<p class="mt-2 text-base font-semibold text-brand-navy">
				{item.supplier?.name ?? 'Sin proveedor'}
			</p>
		</div>

		<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Material</p>
			<p class="mt-2 text-base font-semibold text-brand-navy">
				{item.material?.name ?? 'Sin material'}
			</p>
			<p class="mt-1 text-sm text-on-surface-variant">{item.material?.code ?? '-'}</p>
		</div>

		<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Tecnología</p>
			<p class="mt-2 text-base font-semibold text-brand-navy">
				{item.technology ?? 'Sin tecnología'}
			</p>
			<p class="mt-1 text-sm text-on-surface-variant">
				{item.differentiator ? `Etiqueta: ${item.differentiator}` : 'Sin etiqueta'}
			</p>
		</div>

		<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Índice</p>
			<p class="mt-2 font-mono text-2xl font-bold tracking-tight text-brand-navy">
				{refractiveIndexLabel}
			</p>
		</div>

		<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Inventario</p>
			<p class="mt-2 text-base font-semibold text-brand-navy">{inventorySummary}</p>
			<p class="mt-1 text-sm text-on-surface-variant">
				{getInventoryModeLabel(item.inventoryMode)}
			</p>
		</div>
	</div>

	<div class="mt-6">
		<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Tratamientos</p>
		<div class="mt-2 flex flex-wrap gap-2">
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
				<AppBadge variant="neutral">Sin tratamientos especiales</AppBadge>
			{/if}
		</div>
	</div>
</section>
