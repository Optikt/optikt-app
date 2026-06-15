<script lang="ts">
	import { Minus, Plus, X, Clock, User } from '@lucide/svelte';
	import { formatDate } from '$lib/utils';
	import { getInventoryMovementTypeLabel, InventoryMovementType } from '$lib/shared/enums';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';

	interface Props {
		movements: MovementWithDetails[];
		open: boolean;
		onclose: () => void;
	}

	let { movements, open, onclose }: Props = $props();

	function isOut(movementType: string): boolean {
		return (
			movementType === InventoryMovementType.SALE_OUT ||
			movementType === InventoryMovementType.ADJUSTMENT_OUT
		);
	}

	function movementTitle(movementType: string): string {
		switch (movementType) {
			case InventoryMovementType.SALE_OUT:
				return 'Salida por Venta';
			case InventoryMovementType.CANCEL_REVERT:
				return 'Reversión por Cancelación';
			case InventoryMovementType.RETURN_IN:
				return 'Devolución';
			case InventoryMovementType.ADJUSTMENT_IN:
				return 'Ajuste positivo';
			case InventoryMovementType.ADJUSTMENT_OUT:
				return 'Ajuste negativo';
			case InventoryMovementType.PURCHASE_IN:
				return 'Entrada por Compra';
			default:
				return getInventoryMovementTypeLabel(movementType);
		}
	}
</script>

<div
	class="fixed inset-0 z-40 bg-black/40 transition-opacity"
	class:hidden={!open}
	class:opacity-100={open}
	onclick={onclose}
	role="presentation"
></div>

<svelte:window onkeydown={(e: KeyboardEvent) => e.key === 'Escape' && onclose()} />

<div class="fixed inset-0 z-50 flex items-center justify-center p-4" class:hidden={!open}>
	<div
		class="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
		role="dialog"
		aria-modal="true"
		aria-label="Movimientos de Stock"
	>
		<!-- Header -->
		<div class="flex items-start justify-between border-b border-gray-100 p-5">
			<div>
				<h2 class="text-lg font-bold text-slate-900">Movimientos de Stock</h2>
				<p class="mt-0.5 text-xs text-gray-500">Historial de afectación de inventario</p>
			</div>
			<button
				type="button"
				onclick={onclose}
				class="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100"
				aria-label="Cerrar"
			>
				<X class="h-5 w-5" />
			</button>
		</div>

		<!-- Body -->
		<div class="flex-1 space-y-4 overflow-y-auto p-5">
			{#if movements.length > 0}
				{#each movements as movement (movement.id)}
					<div class="flex gap-4">
						<!-- Icon column -->
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {isOut(
								movement.movementType
							)
								? 'bg-red-50 text-red-500'
								: 'bg-green-50 text-green-500'}"
						>
							{#if isOut(movement.movementType)}
								<Minus class="h-4 w-4" />
							{:else}
								<Plus class="h-4 w-4" />
							{/if}
						</div>

						<!-- Content card -->
						<div class="flex-1 rounded-lg border border-slate-100 bg-slate-50 p-3">
							<div class="flex items-baseline justify-between">
								<span class="text-sm font-bold text-slate-900">
									{movementTitle(movement.movementType)}
								</span>
								<span
									class="text-sm font-extrabold {isOut(movement.movementType)
										? 'text-red-600'
										: 'text-green-600'}"
								>
									{isOut(movement.movementType) ? '' : '+'}{movement.quantityDelta}
								</span>
							</div>

							<p class="mt-0.5 text-xs text-slate-600">{movement.itemName}</p>

							<div class="mt-2 flex gap-4 border-t border-slate-200/60 pt-2 text-xs text-gray-500">
								<span class="inline-flex items-center gap-1">
									<Clock class="h-3 w-3" />
									{formatDate(movement.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
								</span>
								{#if movement.createdByName}
									<span class="inline-flex items-center gap-1">
										<User class="h-3 w-3" />
										{movement.createdByName}
									</span>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			{:else}
				<p class="py-12 text-center text-sm text-gray-400 italic">
					No hay movimientos de stock registrados
				</p>
			{/if}
		</div>
	</div>
</div>
