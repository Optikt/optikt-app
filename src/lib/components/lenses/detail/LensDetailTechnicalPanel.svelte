<script lang="ts">
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { AppBadge, TreatmentBadge } from '$lib/components/ui';
	import { getPriceTypeLabel } from '$lib/shared/enums';
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

<section
	class="rounded-[1.75rem] border border-surface-container-high bg-white px-6 py-6 shadow-sm sm:px-7"
>
	<h2 class="mb-4 text-xs font-semibold tracking-[0.16em] text-outline uppercase">
		Propiedades técnicas
	</h2>

	<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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
				{item.technologyName ?? '-'}
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
			<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
				Tipo de precio
			</p>
			<p class="mt-1 text-sm font-bold text-brand-navy">
				{getPriceTypeLabel(item.priceType)}
			</p>
		</div>
	</div>

	<div class="mt-6 grid gap-6 border-t border-surface-container-high pt-6 md:grid-cols-2">
		<div>
			<p class="mb-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
				Tratamientos
			</p>
			<div class="flex flex-wrap items-start gap-4">
				{#if item.hasAr}
					<div class="flex flex-col gap-1.5">
						<TreatmentBadge type="antiReflective" />
						{#if item.arColors && item.arColors.length > 0}
							<div class="flex flex-wrap items-center gap-1">
								{#each item.arColors as color (color)}
									<span
										class="inline-flex items-center rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase"
									>
										{color}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
				{#if item.hasBluecut}
					<TreatmentBadge type="blueBlock" />
				{/if}
				{#if item.isPhotochromic}
					<div class="flex flex-col gap-1.5">
						<TreatmentBadge type="photochromic" />
						{#if item.photochromicColors && item.photochromicColors.length > 0}
							<div class="flex flex-wrap items-center gap-1">
								{#each item.photochromicColors as color (color)}
									<span
										class="inline-flex items-center rounded-full bg-surface-container px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-on-surface-variant uppercase"
									>
										{color}
									</span>
								{/each}
							</div>
						{/if}
					</div>
				{/if}
				{#if !hasTreatments}
					<AppBadge variant="neutral">Ninguno</AppBadge>
				{/if}
			</div>
		</div>

		{#if item.differentiators && item.differentiators.length > 0}
			<div>
				<p class="mb-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Diferenciadores / Etiquetas
				</p>
				<div class="flex flex-wrap gap-1.5">
					{#each item.differentiators as tag (tag)}
						<span
							class="inline-flex items-center rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-on-surface"
						>
							{tag}
						</span>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</section>
