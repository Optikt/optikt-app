<script lang="ts">
	import { ClipboardList } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { AppBadge, DataGrid } from '$lib/components/ui';
	import { formatDate } from '$lib/utils';
	import {
		getAdjustmentReasonLabel,
		getInventoryMovementTypeLabel,
		getMovementReferenceTypeLabel,
		AdjustmentReason,
		InventoryMovementType,
		MovementReferenceType
	} from '$lib/shared/enums';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';

	interface Props {
		movements: MovementWithDetails[];
		page: number;
		perPage: number;
		total: number;
		totalPages: number;
		loading?: boolean;
		onPageChange: (page: number) => void;
	}

	let {
		movements,
		page,
		perPage,
		total,
		totalPages,
		loading = false,
		onPageChange
	}: Props = $props();

	const columns = [
		{ key: 'date', label: 'Fecha y hora' },
		{ key: 'type', label: 'Tipo' },
		{ key: 'reference', label: 'Referencia' },
		{ key: 'item', label: 'Artículo' },
		{ key: 'lot', label: 'Lote' },
		{ key: 'quantity', label: 'Cant.', align: 'right' as const },
		{ key: 'actor', label: 'Usuario' }
	];

	function movementBadgeVariant(type: string): 'success' | 'error' | 'warning' | 'neutral' {
		switch (type) {
			case InventoryMovementType.PURCHASE_IN:
			case InventoryMovementType.ADJUSTMENT_IN:
			case InventoryMovementType.RETURN_IN:
			case InventoryMovementType.CANCEL_REVERT:
				return 'success';
			case InventoryMovementType.SALE_OUT:
				return 'error';
			case InventoryMovementType.ADJUSTMENT_OUT:
				return 'warning';
			default:
				return 'neutral';
		}
	}

	function movementBadgeLabel(type: string): string {
		switch (type) {
			case InventoryMovementType.PURCHASE_IN:
			case InventoryMovementType.ADJUSTMENT_IN:
			case InventoryMovementType.RETURN_IN:
			case InventoryMovementType.CANCEL_REVERT:
				return 'Entrada';
			case InventoryMovementType.SALE_OUT:
				return 'Salida';
			case InventoryMovementType.ADJUSTMENT_OUT:
				return 'Ajuste';
			default:
				return getInventoryMovementTypeLabel(type);
		}
	}

	function movementReferenceCode(movement: MovementWithDetails): string {
		if (movement.referenceCode) return movement.referenceCode;
		if (movement.referenceType === MovementReferenceType.MANUAL_ADJUSTMENT) return 'Ajuste manual';
		return getMovementReferenceTypeLabel(movement.referenceType);
	}

	function movementReferenceDetail(movement: MovementWithDetails): string {
		return getMovementReferenceTypeLabel(movement.referenceType);
	}

	function movementNotes(movement: MovementWithDetails): string {
		if (!movement.notes) return '';

		const separatorIndex = movement.notes.indexOf(':');
		if (separatorIndex === -1) return movement.notes;

		const rawReason = movement.notes.slice(0, separatorIndex).trim();
		const detail = movement.notes.slice(separatorIndex + 1).trim();

		if (!Object.values(AdjustmentReason).includes(rawReason as AdjustmentReason)) {
			return movement.notes;
		}

		const localizedReason = getAdjustmentReasonLabel(rawReason);
		return detail ? `${localizedReason}: ${detail}` : localizedReason;
	}

	function movementItemName(movement: MovementWithDetails): string {
		return movement.itemName ?? movement.productName ?? movement.lensName ?? 'Ítem no disponible';
	}

	function movementItemMeta(movement: MovementWithDetails): string {
		if (movement.itemCode) return movement.itemCode;
		return movement.itemType === 'LENS' ? 'Cristal' : 'Producto';
	}

	function movementItemLabel(movement: MovementWithDetails): string {
		return movement.itemType === 'LENS' ? 'Lente' : 'Producto';
	}

	function movementItemVariant(movement: MovementWithDetails): 'info' | 'neutral' {
		return movement.itemType === 'LENS' ? 'info' : 'neutral';
	}

	function movementLotCode(movement: MovementWithDetails): string {
		return movement.lotNumber != null
			? `L-${String(movement.lotNumber).padStart(4, '0')}`
			: 'Sin lote';
	}

	function movementQuantityClass(type: string): string {
		switch (movementBadgeVariant(type)) {
			case 'success':
				return 'text-success';
			case 'error':
				return 'text-error';
			case 'warning':
				return 'text-on-warning-container';
			default:
				return 'text-brand-navy';
		}
	}

	function actorInitials(name: string | null): string {
		if (!name) return '-';
		return name
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() ?? '')
			.join('');
	}

	function canOpenReference(movement: MovementWithDetails): boolean {
		if (movement.referenceType === MovementReferenceType.PURCHASE_ORDER) return true;
		if (movement.referenceType === MovementReferenceType.SALE) return true;
		if (movement.referenceType === MovementReferenceType.MANUAL_ADJUSTMENT) {
			return Boolean(movement.productId || movement.lensCatalogItemId);
		}

		return false;
	}

	function openReference(movement: MovementWithDetails) {
		if (movement.referenceType === MovementReferenceType.PURCHASE_ORDER) {
			goto(resolve(`/purchases/${movement.referenceId}`));
			return;
		}

		if (movement.referenceType === MovementReferenceType.SALE) {
			goto(resolve(`/sales/${movement.referenceId}`));
			return;
		}

		if (movement.referenceType === MovementReferenceType.MANUAL_ADJUSTMENT) {
			if (movement.productId) {
				goto(resolve(`/products/${movement.productId}`));
				return;
			}

			if (movement.lensCatalogItemId) {
				goto(resolve(`/lenses/${movement.lensCatalogItemId}`));
			}
		}
	}

	function canOpenItem(movement: MovementWithDetails): boolean {
		return Boolean(movement.productId || movement.lensCatalogItemId);
	}

	function openItem(movement: MovementWithDetails) {
		if (movement.productId) {
			goto(resolve(`/products/${movement.productId}`));
			return;
		}

		if (movement.lensCatalogItemId) {
			goto(resolve(`/lenses/${movement.lensCatalogItemId}`));
		}
	}
</script>

<DataGrid
	{columns}
	items={movements}
	{page}
	{perPage}
	{total}
	{totalPages}
	{loading}
	itemLabel="movimientos"
	emptyTitle="No se encontraron movimientos"
	emptySubtitle="Ajusta los filtros o espera nuevos movimientos para ver historial"
	{onPageChange}
>
	{#snippet emptyIcon()}
		<ClipboardList class="mb-3 h-10 w-10 text-outline" />
	{/snippet}

	{#snippet row(movement)}
		<tr class="bg-surface-container-lowest transition-colors hover:bg-surface-container-low">
			<td class="px-4 py-4 align-top">
				<div class="flex flex-col">
					<span class="font-medium text-brand-navy">
						{formatDate(movement.createdAt, { dateStyle: 'medium' })}
					</span>
					<span class="mt-1 font-mono text-xs text-outline">
						{formatDate(movement.createdAt, { timeStyle: 'short' })}
					</span>
				</div>
			</td>
			<td class="px-4 py-4 align-top">
				<AppBadge variant={movementBadgeVariant(movement.movementType)}>
					{movementBadgeLabel(movement.movementType)}
				</AppBadge>
			</td>
			<td class="px-4 py-4 align-top">
				{#if canOpenReference(movement)}
					<button
						type="button"
						onclick={() => openReference(movement)}
						class="font-mono text-sm font-semibold text-brand-blue transition-colors hover:text-brand-navy"
					>
						{movementReferenceCode(movement)}
					</button>
				{:else}
					<p class="font-mono text-sm font-semibold text-brand-navy">
						{movementReferenceCode(movement)}
					</p>
				{/if}
				<p class="mt-1 text-sm text-on-surface-variant">{movementReferenceDetail(movement)}</p>
				{#if movement.notes}
					<p class="mt-1 line-clamp-2 text-xs leading-relaxed text-outline">
						{movementNotes(movement)}
					</p>
				{/if}
			</td>
			<td class="px-4 py-4 align-top">
				<div class="flex min-w-[15rem] items-start gap-3">
					<AppBadge variant={movementItemVariant(movement)}>{movementItemLabel(movement)}</AppBadge>
					<div class="min-w-0">
						{#if canOpenItem(movement)}
							<button
								type="button"
								onclick={() => openItem(movement)}
								class="text-left font-medium text-on-surface transition-colors hover:text-brand-blue"
							>
								{movementItemName(movement)}
							</button>
						{:else}
							<p class="font-medium text-on-surface">{movementItemName(movement)}</p>
						{/if}
						<p class="mt-1 font-mono text-xs text-outline">{movementItemMeta(movement)}</p>
					</div>
				</div>
			</td>
			<td class="px-4 py-4 align-top">
				<span class="font-mono text-sm font-semibold text-brand-navy"
					>{movementLotCode(movement)}</span
				>
			</td>
			<td class="px-4 py-4 text-right align-top">
				<p
					class="font-mono text-sm font-semibold tabular-nums {movementQuantityClass(
						movement.movementType
					)}"
				>
					{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}
				</p>
				<p class="mt-1 font-mono text-xs text-outline">
					{movement.quantityBefore} → {movement.quantityAfter}
				</p>
			</td>
			<td class="px-4 py-4 align-top">
				<div class="flex items-center gap-2">
					<div
						class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-navy text-[10px] font-bold text-white"
					>
						{actorInitials(movement.createdByName)}
					</div>
					<span class="text-sm text-on-surface-variant">
						{movement.createdByName ?? 'Usuario no disponible'}
					</span>
				</div>
			</td>
		</tr>
	{/snippet}
</DataGrid>
