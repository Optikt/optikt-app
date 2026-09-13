<script lang="ts">
	import { Eye, SquarePen, Trash2 } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import { LensCatalogSource } from '$lib/shared/enums';
	import { collapseRangesForDisplay } from '$lib/utils/opticalRange';
	import { formatPrice } from '$lib/utils';
	import { AppBadge } from '$lib/components/ui';
	import {
		sourceMicroBadgeClass,
		sourceMicroBadgeLabel,
		statusLabel,
		statusVariant,
		supplierLabel,
		totalCost
	} from './lensCatalogDisplay';

	type LensViewHref = `/lenses/${string}`;
	type LensEditHref = `/lenses/${string}/edit`;

	interface Props {
		item: LensCatalogItemWithRelations;
		viewHref?: LensViewHref;
		editHref?: LensEditHref;
		canManage: boolean;
		onView?: (item: LensCatalogItemWithRelations) => void;
		onEdit?: (item: LensCatalogItemWithRelations) => void;
		onDelete: (item: LensCatalogItemWithRelations) => void;
	}

	let { item, viewHref, editHref, canManage, onView, onEdit, onDelete }: Props = $props();
	let displayRanges = $derived(collapseRangesForDisplay(item.ranges ?? []));
	let primaryRange = $derived(displayRanges[0]);
</script>

<div class="space-y-2.5">
	<div class="flex items-start justify-between gap-2">
		<div class="min-w-0 flex-1">
			<h3 class="truncate text-sm leading-5 font-semibold text-on-surface">{item.name}</h3>
			<div class="flex items-center gap-2 text-[11px] text-on-surface-variant">
				<span class="truncate">{supplierLabel(item)}</span>
				<span
					class="inline-flex shrink-0 items-center rounded-sm px-1.5 py-0 text-[10px] leading-[1.1] font-semibold {sourceMicroBadgeClass(
						item
					)}"
				>
					{sourceMicroBadgeLabel(item)}
				</span>
			</div>
		</div>

		<div class="shrink-0 text-right">
			{#if item.salePrice != null}
				<p
					class="font-mono text-sm font-bold text-brand-navy"
					title={`Costo total: ${formatPrice(totalCost(item))}`}
				>
					{formatPrice(item.salePrice)}
				</p>
			{:else}
				<p class="text-xs font-semibold text-outline">Por definir</p>
			{/if}
		</div>
	</div>

	<div class="rounded-lg bg-surface-container-low px-2.5 py-2">
		{#if primaryRange}
			<div class="flex flex-wrap gap-1.5">
				<span
					class="inline-flex rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-navy"
				>
					ESF {primaryRange.sphereLabel}
				</span>
				{#if primaryRange.cylinderLabel}
					<span
						class="inline-flex rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-navy"
					>
						CIL {primaryRange.cylinderLabel}
					</span>
				{/if}
				{#if primaryRange.additionLabel}
					<span
						class="inline-flex rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-[11px] font-semibold text-brand-navy"
					>
						ADD {primaryRange.additionLabel}
					</span>
				{/if}
			</div>
		{:else}
			<p class="text-xs font-semibold text-outline">
				{item.source === LensCatalogSource.LAB ? 'Consultar laboratorio' : 'Sin rangos'}
			</p>
		{/if}
	</div>

	<div
		class="flex items-center justify-between gap-2 rounded-lg bg-surface-container-low px-2.5 py-2"
	>
		<AppBadge variant={statusVariant(item)}>{statusLabel(item)}</AppBadge>
		<div class="flex items-center gap-1">
			{#if viewHref}
				<a
					href={resolve(viewHref)}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-info-container text-on-info-container transition-colors hover:bg-brand-blue-light/40"
					title="Ver lente"
					aria-label="Ver lente"
				>
					<Eye class="h-3.5 w-3.5" />
				</a>
			{:else if onView}
				<button
					type="button"
					onclick={() => onView?.(item)}
					class="inline-flex h-8 w-8 items-center justify-center rounded-md bg-info-container text-on-info-container transition-colors hover:bg-brand-blue-light/40"
					title="Ver lente"
					aria-label="Ver lente"
				>
					<Eye class="h-3.5 w-3.5" />
				</button>
			{/if}

			{#if canManage}
				{#if editHref}
					<a
						href={resolve(editHref)}
						class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
						title="Editar lente"
						aria-label="Editar lente"
					>
						<SquarePen class="h-3.5 w-3.5" />
					</a>
				{:else if onEdit}
					<button
						type="button"
						onclick={() => onEdit?.(item)}
						class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-brand-blue"
						title="Editar lente"
					>
						<SquarePen class="h-3.5 w-3.5" />
					</button>
				{/if}
			{/if}

			{#if canManage}
				<button
					type="button"
					onclick={() => onDelete(item)}
					class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
					title="Eliminar lente"
					aria-label="Eliminar lente"
				>
					<Trash2 class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>
	</div>
</div>
