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

<div class="rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/20 overflow-hidden">
	<button
		type="button"
		onclick={() => (expanded = !expanded)}
		class="w-full flex items-center gap-3 px-4 py-3 border-b border-outline-variant/30 bg-surface-container-high shrink-0"
		aria-expanded={expanded}
		aria-controls="purchase-movements-content"
	>
		<ArrowRightLeft class="h-5 w-5 text-brand-blue shrink-0" />
		<h2 class="text-sm font-semibold uppercase tracking-wide text-brand-navy">
			Movimientos generados
		</h2>
		<AppBadge variant="neutral" class="ml-auto">{movements.length} movimientos</AppBadge>
		<ChevronDown
			class="h-4 w-4 text-on-surface-variant shrink-0 transition-transform duration-200 {expanded
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
								class="hidden sm:block px-1 mt-0.5 font-mono text-[10px] text-on-surface-variant"
							>
								{formatLotCode(movement.lotId, lotsMap)} · {movement.quantityBefore} → {movement.quantityAfter}
								· {formatDate(movement.createdAt, {
									dateStyle: 'short'
								})}
							</div>
							{#if movement.notes}
								<p
									class="px-1 mt-0.5 text-xs text-on-surface-variant truncate"
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
