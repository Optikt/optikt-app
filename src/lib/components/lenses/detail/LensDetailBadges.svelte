<script lang="ts">
	import { Factory, Warehouse, Eye, CircleCheck, CircleX, Clock, Package } from '@lucide/svelte';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import {
		getLensSourceLabel,
		getLensTypeLabel,
		getLensTypeBadgeColor,
		LensCatalogSource
	} from '$lib/shared/enums';
	import { AppBadge } from '$lib/components/ui';
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
	const SourceIcon = $derived(item.source === LensCatalogSource.LAB ? Factory : Warehouse);
	const InventoryIcon = $derived(item.inventoryMode === 'ON_DEMAND' ? Clock : Package);
</script>

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
