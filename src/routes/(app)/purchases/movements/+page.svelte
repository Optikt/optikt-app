<script lang="ts">
	import { Select } from 'flowbite-svelte';
	import { ArrowLeft, Plus, Download } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { TablePagination } from '$lib/components/ui';
	import { MovementsTable } from '$lib/components/purchases';
	import { listInventoryMovements } from '$lib/remote/inventory.remote';
	import { getErrorMessage, formatDate, formatPrice, downloadCsv } from '$lib/utils';
	import {
		ALL_INVENTORY_MOVEMENT_TYPES,
		INVENTORY_MOVEMENT_TYPE_LABELS,
		ALL_MOVEMENT_REFERENCE_TYPES,
		MOVEMENT_REFERENCE_TYPE_LABELS,
		getInventoryMovementTypeLabel,
		getMovementReferenceTypeLabel,
		type InventoryMovementType,
		type MovementReferenceType
	} from '$lib/shared/enums';
	import type { MovementWithDetails } from '$lib/server/db/queries/inventoryMovements';
	import type { PaginatedResult } from '$lib/types';
	import { untrack } from 'svelte';

	let { data } = $props();
	let { initialMovements, totalCount, productId, defaultDateFrom, defaultDateTo } = untrack(
		() => data
	);

	let movementsData = $state<PaginatedResult<MovementWithDetails>>({
		items: initialMovements,
		total: totalCount,
		page: 1,
		perPage: 20,
		totalPages: Math.ceil(totalCount / 20)
	});
	let loading = $state(false);

	let typeFilter = $state<InventoryMovementType | ''>('');
	let referenceFilter = $state<MovementReferenceType | ''>('');
	let dateFrom = $state(defaultDateFrom);
	let dateTo = $state(defaultDateTo);

	async function fetchMovements(page = 1) {
		loading = true;
		try {
			movementsData = await listInventoryMovements({
				page,
				perPage: 20,
				productId: productId || undefined,
				movementType: typeFilter || undefined,
				referenceType: referenceFilter || undefined,
				dateFrom: dateFrom || undefined,
				dateTo: dateTo || undefined
			});
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error cargando movimientos'));
		} finally {
			loading = false;
		}
	}

	function handleFilterChange() {
		fetchMovements(1);
	}

	function handleExportCsv() {
		const headers = [
			'Fecha',
			'Tipo',
			'Documento',
			'Producto',
			'SKU',
			'Lote',
			'Cantidad',
			'Stock Antes',
			'Stock Después',
			'Costo',
			'Notas',
			'Realizado por'
		];
		const rows = movementsData.items.map((m) => [
			formatDate(m.createdAt, { dateStyle: 'short', timeStyle: 'short' }),
			getInventoryMovementTypeLabel(m.movementType),
			getMovementReferenceTypeLabel(m.referenceType),
			m.productName ?? '',
			m.productSku ?? '',
			m.lotNumber != null ? `L-${String(m.lotNumber).padStart(4, '0')}` : '',
			String(m.quantityDelta),
			String(m.quantityBefore),
			String(m.quantityAfter),
			m.totalCostAtAdjustment != null ? formatPrice(m.totalCostAtAdjustment) : '',
			m.notes ?? '',
			m.createdByName ?? ''
		]);
		const suffix = dateFrom && dateTo ? `${dateFrom}-a-${dateTo}` : 'todos';
		downloadCsv(`movimientos-${suffix}.csv`, headers, rows);
	}
</script>

<svelte:head><title>Movimientos de Inventario - Optikt</title></svelte:head>

<div class="p-8">
	<!-- Back + Header -->
	<div class="mb-6">
		<button
			type="button"
			class="mb-4 flex cursor-pointer items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-700"
			onclick={() => goto(resolve('/purchases'))}
		>
			<ArrowLeft class="h-4 w-4" />
			Volver a Órdenes de Compra
		</button>

		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">Movimientos de Inventario</h1>
				<p class="text-slate-500">Historial completo de entradas, salidas y ajustes de stock</p>
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
					onclick={handleExportCsv}
					disabled={movementsData.items.length === 0}
				>
					<Download class="h-4 w-4" />
					Exportar CSV
				</button>
				<button
					type="button"
					class="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
					onclick={() => goto(resolve('/products'))}
				>
					<Plus class="h-4 w-4" />
					Nuevo ajuste
				</button>
			</div>
		</div>
	</div>

	<!-- Filters -->
	<div
		class="mb-6 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4"
	>
		<div class="flex flex-col gap-1">
			<label for="date-from" class="text-xs font-medium text-slate-500">Desde</label>
			<input
				id="date-from"
				type="date"
				bind:value={dateFrom}
				onchange={handleFilterChange}
				class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
			/>
		</div>
		<div class="flex flex-col gap-1">
			<label for="date-to" class="text-xs font-medium text-slate-500">Hasta</label>
			<input
				id="date-to"
				type="date"
				bind:value={dateTo}
				onchange={handleFilterChange}
				class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
			/>
		</div>
		<Select bind:value={typeFilter} onchange={handleFilterChange} class="w-52">
			<option value="">Todos los tipos</option>
			{#each ALL_INVENTORY_MOVEMENT_TYPES as t (t)}
				<option value={t}>{INVENTORY_MOVEMENT_TYPE_LABELS[t]}</option>
			{/each}
		</Select>
		<Select bind:value={referenceFilter} onchange={handleFilterChange} class="w-52">
			<option value="">Todos los documentos</option>
			{#each ALL_MOVEMENT_REFERENCE_TYPES as r (r)}
				<option value={r}>{MOVEMENT_REFERENCE_TYPE_LABELS[r]}</option>
			{/each}
		</Select>
	</div>

	<!-- Table -->
	<MovementsTable movements={movementsData.items} {loading} />

	<!-- Pagination -->
	<TablePagination
		page={movementsData.page}
		perPage={movementsData.perPage}
		total={movementsData.total}
		totalPages={movementsData.totalPages}
		onPageChange={(p) => fetchMovements(p)}
	/>
</div>
