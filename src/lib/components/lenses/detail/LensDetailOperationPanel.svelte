<script lang="ts">
	import { ArrowRightLeft, Package } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { AppBadge, StatusBadge, TreatmentBadge } from '$lib/components/ui';
	import { getInventoryModeLabel, getPriceTypeLabel } from '$lib/shared/enums';
	import { getLensInventorySummary, getLensTaxSummary } from './helpers';

	interface Props {
		item: LensCatalogItemWithRelations;
		canManageInventory?: boolean;
	}

	let { item, canManageInventory = false }: Props = $props();

	const inventorySummary = $derived(getLensInventorySummary(item.inventoryMode, item.stock));
	const hasTreatments = $derived(item.hasAr || item.hasBluecut || item.isPhotochromic);
</script>

<section class="rounded-[1.75rem] bg-surface-container-lowest px-6 py-6 shadow-sm sm:px-7">
	<div class="flex items-start justify-between gap-4">
		<div>
			<p class="text-xs font-semibold tracking-[0.16em] text-outline uppercase">Operación</p>
			<h2 class="font-heading mt-2 text-2xl font-bold text-brand-navy">Disponibilidad y reglas</h2>
		</div>
		<StatusBadge active={item.isActive} />
	</div>

	<div class="mt-5 space-y-3">
		<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
			<div class="flex items-start justify-between gap-3">
				<div class="flex items-center gap-2 text-brand-navy">
					<Package class="h-4 w-4" />
					<p class="text-[10px] font-semibold tracking-[0.16em] uppercase">Inventario</p>
				</div>
				{#if canManageInventory && item.inventoryMode === 'STOCK'}
					<a
						href={resolve(`/lenses/${item.id}/adjustments`)}
						class="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs font-semibold text-brand-blue transition-colors hover:bg-surface-container hover:text-brand-navy"
					>
						<ArrowRightLeft class="h-3.5 w-3.5" />
						Ajustar stock
					</a>
				{/if}
			</div>
			<p class="mt-2 text-lg font-semibold text-brand-navy">{inventorySummary}</p>
			<p class="mt-1 text-sm text-on-surface-variant">
				{getInventoryModeLabel(item.inventoryMode)}
			</p>
		</div>

		<div class="grid gap-3 sm:grid-cols-2">
			<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Tipo de precio
				</p>
				<p class="mt-2 text-base font-semibold text-brand-navy">
					{getPriceTypeLabel(item.priceType)}
				</p>
			</div>

			<div class="rounded-[1.25rem] bg-surface-container-low px-4 py-4">
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">IVA</p>
				<p class="mt-2 text-base font-semibold text-brand-navy">
					{getLensTaxSummary(item.isTaxable)}
				</p>
			</div>
		</div>

		<div>
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
	</div>
</section>
