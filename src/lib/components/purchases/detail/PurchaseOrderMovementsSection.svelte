<script lang="ts">
	import { ArrowRightLeft, ChevronDown, PackageX } from '@lucide/svelte';
	import { AppBadge, EmptyState } from '$lib/components/ui';
	import type { InventoryLot, InventoryMovement } from '$lib/server/db/schema';
	import type { PurchaseOrderItemWithProduct } from '$lib/server/db/queries/purchaseOrders';
	import { getInventoryMovementTypeLabel } from '$lib/shared/enums';
	import { formatDate } from '$lib/utils';
	import { formatLotCode, movementItemName } from '$lib/utils/purchaseOrderDetail';

	interface Props {
		movements: InventoryMovement[];
		items: PurchaseOrderItemWithProduct[];
		lotsMap: Record<string, InventoryLot>;
	}

	let { movements, items, lotsMap }: Props = $props();

	let expanded = $state(false);
</script>

<div class="overflow-hidden rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/20">
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="flex w-full shrink-0 items-center gap-3 border-b border-outline-variant/30 bg-surface-container-high px-4 py-3"
		aria-expanded={expanded}
		aria-controls="purchase-movements-content"
	>
		<ArrowRightLeft class="h-5 w-5 shrink-0 text-brand-blue" />
		<h2 class="text-sm font-semibold tracking-wide text-brand-navy uppercase">
			Movimientos generados
		</h2>
		<AppBadge variant="neutral" class="ml-auto">{movements.length} movimientos</AppBadge>
		<ChevronDown
			class="h-4 w-4 shrink-0 text-on-surface-variant transition-transform duration-200 {expanded
				? 'rotate-180'
				: ''}"
		/>
	</button>

	{#if expanded}
		<div id="purchase-movements-content">
			{#if movements.length > 0}
				<div class="divide-y divide-outline-variant/10">
					{#each movements as movement (movement.id)}
						{@const isInflow = movement.quantityDelta > 0}
						<div class="px-3 py-2">
							<div class="flex items-center gap-2">
								<AppBadge variant={isInflow ? 'success' : 'error'} class="shrink-0">
									{getInventoryMovementTypeLabel(movement.movementType)}
								</AppBadge>
								<p
									class="min-w-0 flex-1 truncate text-sm font-medium text-on-surface"
									title={movementItemName(movement, items)}
								>
									{movementItemName(movement, items)}
								</p>
								<span
									class="shrink-0 font-mono text-sm font-semibold tabular-nums {isInflow
										? 'text-success'
										: 'text-error'}"
								>
									{isInflow ? '+' : ''}{movement.quantityDelta}
									<span class="text-[10px] font-normal text-on-surface-variant"> unds</span>
								</span>
							</div>
							<div
								class="mt-0.5 hidden px-1 font-mono text-[10px] text-on-surface-variant sm:block"
							>
								{formatLotCode(movement.lotId, lotsMap)} · {movement.quantityBefore} → {movement.quantityAfter}
								· {formatDate(movement.createdAt, {
									dateStyle: 'short'
								})}
							</div>
							{#if movement.notes}
								<p
									class="mt-0.5 truncate px-1 text-xs text-on-surface-variant"
									title={movement.notes}
								>
									{movement.notes}
								</p>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<EmptyState
					message="Sin movimientos todavía."
					icon={movementsEmptyIcon}
					ariaLabel="Sin movimientos de inventario"
				/>
			{/if}
		</div>
	{/if}
</div>

{#snippet movementsEmptyIcon()}
	<PackageX class="h-12 w-12" />
{/snippet}
