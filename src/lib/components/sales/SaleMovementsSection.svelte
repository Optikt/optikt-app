<script lang="ts">
	import { Package } from '@lucide/svelte';
	import { formatDate, formatPrice } from '$lib/utils';
	import { getInventoryMovementTypeLabel, InventoryMovementType } from '$lib/shared/enums';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';

	interface Props {
		movements: MovementWithDetails[];
	}

	let { movements }: Props = $props();

	function movementCardClasses(movementType: string): string {
		switch (movementType) {
			case InventoryMovementType.CANCEL_REVERT:
			case InventoryMovementType.RETURN_IN:
			case InventoryMovementType.PURCHASE_IN:
			case InventoryMovementType.ADJUSTMENT_IN:
				return 'bg-success-container/55 text-on-success-container';
			case InventoryMovementType.SALE_OUT:
			case InventoryMovementType.ADJUSTMENT_OUT:
			default:
				return 'bg-error-container/55 text-on-error-container';
		}
	}

	function movementQuantityClasses(quantityDelta: number): string {
		return quantityDelta > 0 ? 'text-success' : 'text-error';
	}
</script>

{#if movements.length > 0}
	<section class="glass-card overflow-hidden">
		<div class="flex items-center gap-3 bg-surface-container-lowest px-6 py-5">
			<div
				class="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
			>
				<Package class="h-5 w-5" />
			</div>
			<div>
				<h2 class="text-xl font-semibold text-brand-navy">Movimientos de Stock</h2>
				<p class="text-sm text-on-surface-variant">
					Impacto de la venta sobre inventario y reversiones asociadas.
				</p>
			</div>
		</div>

		<div class="grid gap-4 px-6 py-6 lg:grid-cols-2">
			{#each movements as movement (movement.id)}
				<div class="rounded-[1.5rem] bg-surface-container-low p-5">
					<div class="flex items-start justify-between gap-4">
						<div class="flex items-start gap-4">
							<div
								class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {movementCardClasses(
									movement.movementType
								)}"
							>
								<Package class="h-5 w-5" />
							</div>
							<div>
								<p class="text-sm font-black tracking-[0.14em] text-brand-navy uppercase">
									{movement.productName ?? 'Movimiento inventario'}
								</p>
								<div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-outline">
									{#if movement.productSku}
										<span class="font-mono">ID: {movement.productSku}</span>
									{/if}
									{#if movement.lotNumber != null}
										<span class="font-mono"
											>Lote L-{String(movement.lotNumber).padStart(4, '0')}</span
										>
									{/if}
									<span
										>{formatDate(movement.createdAt, {
											dateStyle: 'medium',
											timeStyle: 'short'
										})}</span
									>
								</div>
								{#if movement.createdByName}
									<p class="mt-2 text-sm text-on-surface-variant">
										Realizado por {movement.createdByName}
									</p>
								{/if}
							</div>
						</div>

						<div class="text-right">
							<p
								class="font-mono text-xl font-bold {movementQuantityClasses(
									movement.quantityDelta
								)}"
							>
								{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}
							</p>
							<p class="mt-1 text-[11px] font-semibold tracking-[0.18em] text-slate-500 uppercase">
								{getInventoryMovementTypeLabel(movement.movementType)}
							</p>
							{#if movement.totalCostAtAdjustment != null}
								<p class="mt-2 font-mono text-xs text-outline">
									{formatPrice(movement.totalCostAtAdjustment)}
								</p>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</section>
{/if}
