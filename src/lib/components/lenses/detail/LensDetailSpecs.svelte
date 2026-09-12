<script lang="ts">
	import { ArrowRightLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { getInventoryModeLabel, getPriceTypeLabel } from '$lib/shared/enums/lensTypes';
	import { getLensTaxSummary } from '$lib/components/lenses/detail/helpers';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';

	interface Props {
		item: LensCatalogItemWithRelations;
		variant: 'mobile' | 'desktop';
		inventorySummary: string;
		refractiveIndexLabel: string | null;
		isAdmin: boolean;
	}

	let { item, variant, inventorySummary, refractiveIndexLabel, isAdmin }: Props = $props();

	const isMobile = $derived(variant === 'mobile');
</script>

{#if isMobile}
	<div
		class="rounded-2xl border border-[var(--color-surface-container-high)] bg-surface-container-lowest p-4 shadow-[var(--ds-shadow-md)]"
	>
		<div class="grid grid-cols-2 gap-x-3 gap-y-4">
			{#if item.material}
				<div>
					<p class="text-xs font-medium text-outline">Material</p>
					<p class="font-heading mt-0.5 text-sm font-semibold text-brand-navy">
						{item.material.name}
					</p>
					<p class="text-xs text-on-surface-variant">{item.material.code}</p>
				</div>
			{/if}
			{#if item.supplier}
				<div>
					<p class="text-xs font-medium text-outline">Proveedor</p>
					<p class="font-heading mt-0.5 text-sm font-semibold text-brand-navy">
						{item.supplier.name}
					</p>
				</div>
			{/if}
			<div>
				<p class="text-xs font-medium text-outline">Índice de refracción</p>
				<p class="mt-0.5 font-mono text-sm font-semibold tracking-tight text-brand-navy">
					{refractiveIndexLabel ?? '—'}
				</p>
			</div>
			{#if item.technologyName}
				<div>
					<p class="text-xs font-medium text-outline">Tecnología</p>
					<p class="font-heading mt-0.5 text-sm font-semibold text-brand-navy">
						{item.technologyName}
					</p>
				</div>
			{/if}
			<div>
				<p class="text-xs font-medium text-outline">Tipo de precio</p>
				<p class="mt-0.5 text-sm font-semibold text-brand-navy">
					{getPriceTypeLabel(item.priceType)}
				</p>
			</div>
			<div>
				<p class="text-xs font-medium text-outline">IVA</p>
				<p class="mt-0.5 text-sm font-semibold text-brand-navy">
					{getLensTaxSummary(item.isTaxable)}
				</p>
			</div>
			<div class="col-span-2">
				<p class="text-xs font-medium text-outline">Inventario</p>
				<p class="font-heading mt-0.5 text-sm font-semibold text-brand-navy">
					{inventorySummary}
				</p>
				<p class="text-xs text-on-surface-variant">
					{getInventoryModeLabel(item.inventoryMode)}
				</p>
				{#if isAdmin && item.inventoryMode === 'STOCK'}
					<a
						href={resolve(`/lenses/${item.id}/adjustments`)}
						class="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-2 text-[11px] font-semibold text-brand-blue transition-colors hover:bg-surface-container hover:text-brand-navy"
					>
						<ArrowRightLeft class="h-3.5 w-3.5" />
						Ajustar stock
					</a>
				{/if}
			</div>
		</div>

		{#if item.hasAr || item.hasBluecut || item.isPhotochromic}
			<div
				class="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--color-surface-container-high)] pt-4"
			>
				<p class="mr-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Tratamientos
				</p>
				{#if item.hasAr}
					<span
						class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1.5 text-xs font-bold text-on-info-container"
						>AR</span
					>
				{/if}
				{#if item.hasBluecut}
					<span
						class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1.5 text-xs font-bold text-on-info-container"
						>Bluecut</span
					>
				{/if}
				{#if item.isPhotochromic}
					<span
						class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1.5 text-xs font-bold text-on-info-container"
						>Fotocromático</span
					>
				{/if}
			</div>
		{/if}

		{#if item.differentiators && item.differentiators.some((t) => t.trim().length > 0)}
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<p class="mr-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Etiquetas
				</p>
				{#each item.differentiators.filter((t) => t.trim().length > 0) as tag (tag)}
					<span
						class="inline-flex items-center rounded-lg bg-surface-container-high px-2.5 py-1.5 text-xs font-semibold text-on-surface"
						>{tag}</span
					>
				{/each}
			</div>
		{/if}
	</div>
{:else}
	<div
		class="rounded-[1.75rem] border border-[var(--color-surface-container-high)] bg-surface-container-lowest px-7 py-6 shadow-[var(--ds-shadow-md)]"
	>
		<div class="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3">
			{#if item.material}
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Material</p>
					<p class="font-heading mt-1.5 text-sm font-bold text-brand-navy">
						{item.material.name}
					</p>
					<p class="mt-0.5 text-xs text-on-surface-variant">{item.material.code}</p>
				</div>
			{/if}
			{#if item.supplier}
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
						Proveedor
					</p>
					<p class="font-heading mt-1.5 text-sm font-bold text-brand-navy">
						{item.supplier.name}
					</p>
				</div>
			{/if}
			<div>
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Índice de refracción
				</p>
				<p class="mt-1.5 font-mono text-sm font-bold tracking-tight text-brand-navy">
					{refractiveIndexLabel ?? '—'}
				</p>
			</div>
			{#if item.technologyName}
				<div>
					<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
						Tecnología
					</p>
					<p class="font-heading mt-1.5 text-sm font-bold text-brand-navy">
						{item.technologyName}
					</p>
				</div>
			{/if}
			<div>
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Tipo de precio
				</p>
				<p class="mt-1.5 text-sm font-bold text-brand-navy">
					{getPriceTypeLabel(item.priceType)}
				</p>
			</div>
			<div>
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">IVA</p>
				<p class="mt-1.5 text-sm font-bold text-brand-navy">
					{getLensTaxSummary(item.isTaxable)}
				</p>
			</div>
			<div>
				<p class="text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">Inventario</p>
				<p class="font-heading mt-1.5 text-sm font-bold text-brand-navy">{inventorySummary}</p>
				<p class="mt-0.5 text-xs text-on-surface-variant">
					{getInventoryModeLabel(item.inventoryMode)}
				</p>
				{#if isAdmin && item.inventoryMode === 'STOCK'}
					<a
						href={resolve(`/lenses/${item.id}/adjustments`)}
						class="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-surface px-2.5 py-1.5 text-[10px] font-semibold text-brand-blue transition-colors hover:bg-surface-container hover:text-brand-navy"
					>
						<ArrowRightLeft class="h-3 w-3" />
						Ajustar stock
					</a>
				{/if}
			</div>
		</div>

		{#if item.hasAr || item.hasBluecut || item.isPhotochromic}
			<div
				class="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--color-surface-container-high)] pt-5"
			>
				<p class="mr-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Tratamientos
				</p>
				{#if item.hasAr}
					<span
						class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1 text-[11px] font-bold text-on-info-container"
						>AR</span
					>
				{/if}
				{#if item.hasBluecut}
					<span
						class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1 text-[11px] font-bold text-on-info-container"
						>Bluecut</span
					>
				{/if}
				{#if item.isPhotochromic}
					<span
						class="inline-flex items-center gap-1 rounded-lg bg-info-container px-2.5 py-1 text-[11px] font-bold text-on-info-container"
						>Fotocromático</span
					>
				{/if}
			</div>
		{/if}

		{#if item.differentiators && item.differentiators.some((t) => t.trim().length > 0)}
			<div class="mt-4 flex flex-wrap items-center gap-2">
				<p class="mr-2 text-[10px] font-semibold tracking-[0.16em] text-outline uppercase">
					Etiquetas
				</p>
				{#each item.differentiators.filter((t) => t.trim().length > 0) as tag (tag)}
					<span
						class="inline-flex items-center rounded-lg bg-surface-container-high px-2.5 py-1 text-xs font-semibold text-on-surface"
						>{tag}</span
					>
				{/each}
			</div>
		{/if}
	</div>
{/if}
