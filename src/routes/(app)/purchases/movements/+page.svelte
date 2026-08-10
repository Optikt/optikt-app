<script lang="ts">
	import { Download, RotateCcw, Search } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { MovementsTable } from '$lib/components/purchases';
	import { PageHeader } from '$lib/components/ui';
	import { listInventoryMovements } from '$lib/remote/inventory.remote';
	import { downloadCsv, formatDate, formatPrice, getErrorMessage } from '$lib/utils';
	import {
		ALL_INVENTORY_MOVEMENT_TYPES,
		ALL_MOVEMENT_REFERENCE_TYPES,
		INVENTORY_MOVEMENT_TYPE_LABELS,
		MOVEMENT_REFERENCE_TYPE_LABELS,
		getInventoryMovementTypeLabel,
		getMovementReferenceTypeLabel,
		type InventoryMovementType as InventoryMovementTypeValue,
		type MovementReferenceType as MovementReferenceTypeValue
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

	let typeFilter = $state<InventoryMovementTypeValue | ''>('');
	let referenceFilter = $state<MovementReferenceTypeValue | ''>('');
	let dateFrom = $state(defaultDateFrom);
	let dateTo = $state(defaultDateTo);
	let search = $state('');
	let searchInput = $state('');
	let searchTimer: ReturnType<typeof setTimeout> | undefined;

	const filterLabelClass =
		'text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase';
	const selectClass =
		'rounded-lg border-none bg-surface-container-high px-4 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';
	const inputClass =
		'w-full rounded-lg border-none bg-surface-container-high p-3 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';

	const hasActiveFilters = $derived(
		Boolean(
			typeFilter ||
			referenceFilter ||
			search ||
			dateFrom !== defaultDateFrom ||
			dateTo !== defaultDateTo
		)
	);

	async function fetchMovements(page = 1) {
		loading = true;

		try {
			movementsData = await listInventoryMovements({
				page,
				perPage: movementsData.perPage,
				productId: productId || undefined,
				movementType: typeFilter || undefined,
				referenceType: referenceFilter || undefined,
				search: search || undefined,
				dateFrom: dateFrom || undefined,
				dateTo: dateTo || undefined
			});
		} catch (error) {
			toast.error(getErrorMessage(error, 'Error cargando movimientos'));
		} finally {
			loading = false;
		}
	}

	function clearSearchTimer() {
		if (searchTimer) {
			clearTimeout(searchTimer);
			searchTimer = undefined;
		}
	}

	function goBack() {
		goto(resolve('/purchases'));
	}

	function applyFilters() {
		clearSearchTimer();
		search = searchInput.trim();
		void fetchMovements(1);
	}

	function handleSearchInput(event: Event) {
		const nextValue = (event.currentTarget as HTMLInputElement).value;
		searchInput = nextValue;
		clearSearchTimer();
		searchTimer = setTimeout(() => {
			search = nextValue.trim();
			void fetchMovements(1);
		}, 250);
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			applyFilters();
		}
	}

	function resetFilters() {
		clearSearchTimer();
		typeFilter = '';
		referenceFilter = '';
		dateFrom = defaultDateFrom;
		dateTo = defaultDateTo;
		search = '';
		searchInput = '';
		void fetchMovements(1);
	}

	function itemName(movement: MovementWithDetails): string {
		return movement.itemName ?? movement.productName ?? movement.lensName ?? '';
	}

	function itemCode(movement: MovementWithDetails): string {
		return movement.itemCode ?? '';
	}

	function lotCode(movement: MovementWithDetails): string {
		return movement.lotNumber != null ? `L-${String(movement.lotNumber).padStart(4, '0')}` : '';
	}

	function referenceCode(movement: MovementWithDetails): string {
		return movement.referenceCode ?? getMovementReferenceTypeLabel(movement.referenceType);
	}

	function handleExportCsv() {
		const headers = [
			'Fecha',
			'Tipo',
			'Referencia',
			'Documento',
			'Artículo',
			'Código',
			'Lote',
			'Cantidad',
			'Stock Antes',
			'Stock Después',
			'Costo',
			'Notas',
			'Usuario'
		];

		const rows = movementsData.items.map((movement) => [
			formatDate(movement.createdAt, { dateStyle: 'short', timeStyle: 'short' }),
			getInventoryMovementTypeLabel(movement.movementType),
			referenceCode(movement),
			getMovementReferenceTypeLabel(movement.referenceType),
			itemName(movement),
			itemCode(movement),
			lotCode(movement),
			String(movement.quantityDelta),
			String(movement.quantityBefore),
			String(movement.quantityAfter),
			movement.totalCostAtAdjustment != null ? formatPrice(movement.totalCostAtAdjustment) : '',
			movement.notes ?? '',
			movement.createdByName ?? ''
		]);

		const suffix = dateFrom && dateTo ? `${dateFrom}-a-${dateTo}` : 'todos';
		downloadCsv(`movimientos-${suffix}.csv`, headers, rows);
	}
</script>

<svelte:head>
	<title>Movimientos de Inventario - Optikt</title>
</svelte:head>

<div class="space-y-6 p-6">
	<PageHeader title="Movimientos de Inventario" backLabel="Volver a órdenes" backOnClick={goBack}>
		{#snippet actions()}
			<button
				type="button"
				onclick={handleExportCsv}
				disabled={movementsData.items.length === 0 || loading}
				class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-brand-navy transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Download class="h-4 w-4" />
				Exportar CSV
			</button>
		{/snippet}
	</PageHeader>

	<p class="-mt-3 text-sm text-on-surface-variant">
		Historial detallado de entradas, salidas y ajustes de stock.
	</p>

	<section class="glass-card bg-surface-container-low p-4">
		<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-12 xl:items-end xl:gap-4">
			<div class="space-y-2 md:col-span-2 xl:col-span-4">
				<p class={filterLabelClass}>Rango de fechas</p>
				<div class="grid gap-3 sm:grid-cols-2">
					<input
						type="date"
						bind:value={dateFrom}
						onchange={applyFilters}
						class={inputClass}
						aria-label="Fecha desde"
					/>
					<input
						type="date"
						bind:value={dateTo}
						onchange={applyFilters}
						class={inputClass}
						aria-label="Fecha hasta"
					/>
				</div>
			</div>

			<div class="space-y-2 xl:col-span-2">
				<p class={filterLabelClass}>Tipo de movimiento</p>
				<div class="relative">
					<select
						bind:value={typeFilter}
						onchange={applyFilters}
						class={`${selectClass} w-full appearance-none pr-10`}
					>
						<option value="">Todos los tipos</option>
						{#each ALL_INVENTORY_MOVEMENT_TYPES as type (type)}
							<option value={type}>{INVENTORY_MOVEMENT_TYPE_LABELS[type]}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="space-y-2 xl:col-span-2">
				<p class={filterLabelClass}>Documento</p>
				<div class="relative">
					<select
						bind:value={referenceFilter}
						onchange={applyFilters}
						class={`${selectClass} w-full appearance-none pr-10`}
					>
						<option value="">Todos los documentos</option>
						{#each ALL_MOVEMENT_REFERENCE_TYPES as type (type)}
							<option value={type}>{MOVEMENT_REFERENCE_TYPE_LABELS[type]}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="space-y-2 xl:col-span-3">
				<p class={filterLabelClass}>Buscar</p>
				<div class="relative">
					<Search
						class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-outline"
					/>
					<input
						type="text"
						value={searchInput}
						oninput={handleSearchInput}
						onkeydown={handleSearchKeydown}
						placeholder="PO-0001, #0001, lote o artículo..."
						class={`${inputClass} pl-11`}
						aria-label="Buscar movimientos"
					/>
				</div>
			</div>

			<button
				type="button"
				onclick={resetFilters}
				disabled={!hasActiveFilters}
				class={`inline-flex h-[3rem] w-[3rem] items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 md:justify-self-end xl:col-span-1 xl:self-end ${
					hasActiveFilters
						? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
						: 'bg-surface-container-high text-outline'
				}`}
				aria-label="Limpiar filtros"
				title="Limpiar filtros"
			>
				<RotateCcw class="h-4 w-4" />
			</button>
		</div>
	</section>

	<MovementsTable
		movements={movementsData.items}
		page={movementsData.page}
		perPage={movementsData.perPage}
		total={movementsData.total}
		totalPages={movementsData.totalPages}
		{loading}
		onPageChange={(page) => {
			void fetchMovements(page);
		}}
	/>
</div>
