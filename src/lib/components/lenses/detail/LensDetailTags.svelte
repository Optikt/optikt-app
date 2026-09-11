<script lang="ts">
	import { getLensSourceLabel, getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';

	interface Props {
		item: LensCatalogItemWithRelations;
		variant: 'mobile' | 'desktop';
		inventorySummary: string;
	}

	let { item, variant, inventorySummary }: Props = $props();

	const isMobile = $derived(variant === 'mobile');
</script>

{#if isMobile}
	<div class="scrollbar-none overflow-x-auto px-4 pt-3">
		<div class="flex items-center gap-2 whitespace-nowrap">
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-info-container px-3 py-2 text-[11px] font-bold tracking-[0.12em] text-on-info-container uppercase"
			>
				{getLensSourceLabel(item.source)}
			</span>
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-purple-container px-3 py-2 text-[11px] font-bold tracking-[0.12em] text-on-purple-container uppercase"
			>
				{getLensTypeLabel(item.type)}
			</span>
			<span
				class="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-bold tracking-[0.12em] uppercase"
				class:bg-success-container={!item.deletedAt}
				class:text-on-success-container={!item.deletedAt}
				class:bg-surface-container-high={!!item.deletedAt}
				class:text-outline={!!item.deletedAt}
			>
				{!item.deletedAt ? 'Activo' : 'Eliminado'}
			</span>
			<span
				class="inline-flex items-center gap-1.5 rounded-full bg-warning-container px-3 py-2 text-[11px] font-bold tracking-[0.12em] text-on-warning-container uppercase"
			>
				{inventorySummary}
			</span>
		</div>
	</div>
{:else}
	<div class="-mt-4 flex flex-wrap items-center gap-2">
		<span
			class="inline-flex items-center gap-1.5 rounded-full bg-info-container px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-on-info-container uppercase"
		>
			{getLensSourceLabel(item.source)}
		</span>
		<span
			class="inline-flex items-center gap-1.5 rounded-full bg-purple-container px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-on-purple-container uppercase"
		>
			{getLensTypeLabel(item.type)}
		</span>
		<span
			class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] uppercase"
			class:bg-success-container={!item.deletedAt}
			class:text-on-success-container={!item.deletedAt}
			class:bg-surface-container-high={!!item.deletedAt}
			class:text-outline={!!item.deletedAt}
		>
			{!item.deletedAt ? 'Activo' : 'Eliminado'}
		</span>
		<span
			class="inline-flex items-center gap-1.5 rounded-full bg-warning-container px-3 py-1.5 text-[10px] font-bold tracking-[0.12em] text-on-warning-container uppercase"
		>
			{inventorySummary}
		</span>
	</div>
{/if}
