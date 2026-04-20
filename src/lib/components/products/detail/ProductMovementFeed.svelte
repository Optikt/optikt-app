<script lang="ts">
	import {
		CircleArrowDown,
		CircleArrowUp,
		History,
		PackagePlus,
		RotateCcw,
		SlidersHorizontal
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import {
		getInventoryMovementTypeLabel,
		getMovementReferenceTypeLabel,
		InventoryMovementType
	} from '$lib/shared/enums/inventoryTypes';
	import { formatDate } from '$lib/utils';
	import { formatQuantityDelta } from './helpers';

	interface MovementItem {
		id: string;
		movementType: string;
		quantityDelta: number;
		referenceType: string | null;
		notes: string | null;
		createdByName: string | null;
		createdAt: Date | string;
	}

	interface Props {
		movements: MovementItem[];
		total: number;
		productId: string;
		canManageInventory?: boolean;
	}

	let { movements, total, productId, canManageInventory = true }: Props = $props();

	const visibleMovements = $derived(movements.slice(0, 5));

	function metaText(movement: MovementItem): string {
		if (movement.notes) return movement.notes;

		const parts: string[] = [];
		if (movement.referenceType) parts.push(getMovementReferenceTypeLabel(movement.referenceType));
		if (movement.createdByName) parts.push(`Por: ${movement.createdByName}`);

		return parts.join(' · ') || 'Sin detalle adicional';
	}

	function deltaClass(quantityDelta: number): string {
		return quantityDelta > 0 ? 'text-on-success-container' : 'text-on-error-container';
	}

	function iconWrapperClass(movementType: string): string {
		switch (movementType) {
			case InventoryMovementType.PURCHASE_IN:
			case InventoryMovementType.RETURN_IN:
				return 'bg-success-container/60 text-on-success-container';
			case InventoryMovementType.ADJUSTMENT_IN:
			case InventoryMovementType.ADJUSTMENT_OUT:
				return 'bg-warning-container/60 text-on-warning-container';
			case InventoryMovementType.CANCEL_REVERT:
				return 'bg-info-container/70 text-on-info-container';
			default:
				return 'bg-error-container/60 text-on-error-container';
		}
	}
</script>

<section class="glass-card bg-surface-container-lowest p-8">
	<div class="flex items-center justify-between gap-4">
		<h2 class="font-heading text-2xl font-bold tracking-[-0.02em] text-brand-navy">
			Historial de Movimientos
		</h2>
		<History class="h-5 w-5 text-outline" />
	</div>

	{#if total > 0}
		<div class="mt-8 space-y-5">
			{#each visibleMovements as movement (movement.id)}
				<div class="flex items-start gap-4">
					<div
						class="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full {iconWrapperClass(
							movement.movementType
						)}"
					>
						{#if movement.movementType === InventoryMovementType.PURCHASE_IN}
							<PackagePlus class="h-4 w-4" />
						{:else if movement.movementType === InventoryMovementType.SALE_OUT}
							<CircleArrowUp class="h-4 w-4" />
						{:else if movement.movementType === InventoryMovementType.CANCEL_REVERT}
							<RotateCcw class="h-4 w-4" />
						{:else if movement.movementType === InventoryMovementType.RETURN_IN}
							<CircleArrowDown class="h-4 w-4" />
						{:else}
							<SlidersHorizontal class="h-4 w-4" />
						{/if}
					</div>

					<div class="min-w-0 flex-1 space-y-1">
						<div class="flex items-start justify-between gap-4">
							<p class="text-sm font-semibold text-brand-navy">
								{getInventoryMovementTypeLabel(movement.movementType)}
							</p>
							<p class="font-mono text-sm font-bold {deltaClass(movement.quantityDelta)}">
								{formatQuantityDelta(movement.quantityDelta)}
							</p>
						</div>

						<div class="flex items-center justify-between gap-4">
							<p class="min-w-0 truncate text-[0.75rem] text-on-surface-variant">
								{metaText(movement)}
							</p>
							<p
								class="text-[0.65rem] font-bold tracking-[0.14em] whitespace-nowrap text-outline uppercase"
							>
								{formatDate(movement.createdAt, {
									day: '2-digit',
									month: 'short',
									year: 'numeric'
								})}
							</p>
						</div>
					</div>
				</div>
			{/each}
		</div>

		{#if canManageInventory}
			<a
				href={resolve(`/purchases/movements?productId=${productId}`)}
				class="mt-8 block rounded-lg bg-surface-container-low px-4 py-3 text-center text-[0.75rem] font-bold tracking-[0.18em] text-outline uppercase transition-colors hover:bg-surface-container hover:text-brand-blue"
			>
				Ver todos los movimientos
			</a>
		{/if}
	{:else}
		<div class="mt-8 rounded-xl bg-surface-container-low px-6 py-10 text-center">
			<div
				class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container text-outline"
			>
				<History class="h-5 w-5" />
			</div>
			<p class="mt-4 font-semibold text-brand-navy">Sin movimientos registrados</p>
			<p class="mt-1 text-sm text-on-surface-variant">
				Los ajustes, compras y ventas del producto apareceran aqui.
			</p>
		</div>
	{/if}
</section>
