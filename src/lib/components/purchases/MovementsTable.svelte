<script lang="ts">
	import { TableHeadCell, TableBodyCell } from 'flowbite-svelte';
	import { ClipboardList, Eye } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { DataTable, ActionButton } from '$lib/components/ui';
	import { formatPrice, formatDate } from '$lib/utils';
	import {
		getInventoryMovementTypeLabel,
		getMovementReferenceTypeLabel,
		MovementReferenceType,
		InventoryMovementType
	} from '$lib/shared/enums';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';

	interface Props {
		movements: MovementWithDetails[];
		loading?: boolean;
		hideProductColumn?: boolean;
	}

	let { movements, loading = false, hideProductColumn = false }: Props = $props();

	function movementTypeClass(type: string): string {
		switch (type) {
			case InventoryMovementType.PURCHASE_IN:
			case InventoryMovementType.ADJUSTMENT_IN:
			case InventoryMovementType.RETURN_IN:
			case InventoryMovementType.CANCEL_REVERT:
				return 'text-emerald-700 bg-emerald-50';
			case InventoryMovementType.SALE_OUT:
			case InventoryMovementType.ADJUSTMENT_OUT:
				return 'text-red-700 bg-red-50';
			default:
				return 'text-slate-700 bg-slate-50';
		}
	}

	function navigateToReference(movement: MovementWithDetails) {
		if (movement.referenceType === MovementReferenceType.PURCHASE_ORDER) {
			goto(resolve(`/purchases/${movement.referenceId}`));
		} else if (movement.referenceType === MovementReferenceType.SALE) {
			goto(resolve(`/sales/${movement.referenceId}`));
		} else if (
			movement.referenceType === MovementReferenceType.MANUAL_ADJUSTMENT &&
			movement.productId
		) {
			goto(resolve(`/products/${movement.productId}`));
		}
	}
</script>

<DataTable
	items={movements}
	{loading}
	emptyIcon={ClipboardList}
	emptyTitle="No se encontraron movimientos"
	emptyDescription="Los movimientos se generan al confirmar compras, registrar ventas o realizar ajustes manuales"
>
	{#snippet header()}
		<TableHeadCell class="font-semibold">Fecha</TableHeadCell>
		<TableHeadCell class="font-semibold">Tipo</TableHeadCell>
		<TableHeadCell class="font-semibold">Documento</TableHeadCell>
		{#if !hideProductColumn}
			<TableHeadCell class="font-semibold">Producto</TableHeadCell>
		{/if}
		<TableHeadCell class="w-20 font-semibold">Lote</TableHeadCell>
		<TableHeadCell class="text-right font-semibold">Cantidad</TableHeadCell>
		<TableHeadCell class="text-right font-semibold">Costo</TableHeadCell>
		<TableHeadCell class="font-semibold">Realizado por</TableHeadCell>
	{/snippet}

	{#snippet row(movement)}
		<TableBodyCell>
			<span class="text-sm text-slate-600">
				{formatDate(movement.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}
			</span>
		</TableBodyCell>
		<TableBodyCell>
			<span
				class="inline-block rounded px-2 py-0.5 text-xs font-medium {movementTypeClass(
					movement.movementType
				)}"
			>
				{getInventoryMovementTypeLabel(movement.movementType)}
			</span>
		</TableBodyCell>
		<TableBodyCell>
			<span class="text-sm text-slate-600">
				{getMovementReferenceTypeLabel(movement.referenceType)}
			</span>
		</TableBodyCell>
		{#if !hideProductColumn}
			<TableBodyCell>
				{#if movement.productName}
					<div>
						<span class="font-medium">{movement.productName}</span>
						{#if movement.productSku}
							<span class="ml-2 font-mono text-xs text-slate-400">{movement.productSku}</span>
						{/if}
					</div>
				{:else}
					<span class="text-slate-400">—</span>
				{/if}
			</TableBodyCell>
		{/if}
		<TableBodyCell>
			{#if movement.lotNumber != null}
				<span class="font-mono text-sm">L-{String(movement.lotNumber).padStart(4, '0')}</span>
			{:else}
				<span class="text-slate-400">—</span>
			{/if}
		</TableBodyCell>
		<TableBodyCell class="text-right">
			<span
				class="font-mono text-sm font-medium tabular-nums {movement.quantityDelta > 0
					? 'text-emerald-600'
					: 'text-red-600'}"
			>
				{movement.quantityDelta > 0 ? '+' : ''}{movement.quantityDelta}
			</span>
		</TableBodyCell>
		<TableBodyCell class="text-right">
			{#if movement.totalCostAtAdjustment != null}
				<span class="font-mono text-sm text-slate-600 tabular-nums">
					{formatPrice(movement.totalCostAtAdjustment)}
				</span>
			{:else}
				<span class="text-slate-400">—</span>
			{/if}
		</TableBodyCell>
		<TableBodyCell>
			<span class="text-sm text-slate-600">{movement.createdByName ?? '—'}</span>
		</TableBodyCell>
	{/snippet}

	{#snippet actions(movement)}
		<ActionButton icon={Eye} title="Ver referencia" onclick={() => navigateToReference(movement)} />
	{/snippet}
</DataTable>
