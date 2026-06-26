<script lang="ts">
	import {
		ArrowDownWideNarrow,
		ArrowUpWideNarrow,
		ChevronDown,
		RotateCcw,
		Search,
		SlidersHorizontal,
		TriangleAlert,
		Wallet
	} from '@lucide/svelte';
	import {
		PURCHASE_ORDER_STATUS_LABELS,
		PURCHASE_ORDER_UI_STATE_LABELS,
		PurchaseOrderStatus,
		PurchaseOrderUiState
	} from '$lib/shared/enums';

	type PurchaseOrderStatusFilter =
		| PurchaseOrderStatus
		| PurchaseOrderUiState.DRAFT_IN_PROGRESS
		| PurchaseOrderUiState.DRAFT_READY
		| '';

	type PurchaseOrderSortField = 'orderNumber' | 'orderDate' | 'createdAt' | 'status';
	type SortDirection = 'asc' | 'desc';

	interface Supplier {
		id: string;
		name: string;
	}

	interface Props {
		search: string;
		statusFilter: PurchaseOrderStatusFilter;
		supplierFilter: string;
		pendingBalanceFilter: boolean;
		overdueBalanceFilter: boolean;
		orderBy: PurchaseOrderSortField;
		orderSort: SortDirection;
		hasActiveFilters: boolean;
		suppliers: Supplier[];
		onSearch: (value: string) => void;
		onStatusChange: (value: PurchaseOrderStatusFilter) => void;
		onSupplierChange: (value: string) => void;
		onTogglePending: () => void;
		onToggleOverdue: () => void;
		onSortFieldChange: (value: PurchaseOrderSortField) => void;
		onToggleSortDirection: () => void;
		onClearFilters: () => void;
	}

	let {
		search,
		statusFilter,
		supplierFilter,
		pendingBalanceFilter,
		overdueBalanceFilter,
		orderBy,
		orderSort,
		hasActiveFilters,
		suppliers,
		onSearch,
		onStatusChange,
		onSupplierChange,
		onTogglePending,
		onToggleOverdue,
		onSortFieldChange,
		onToggleSortDirection,
		onClearFilters
	}: Props = $props();

	let mobileFiltersOpen = $state(false);

	const statusFilterOptions = [
		{
			value: PurchaseOrderUiState.DRAFT_IN_PROGRESS,
			label: PURCHASE_ORDER_UI_STATE_LABELS.DRAFT_IN_PROGRESS
		},
		{ value: PurchaseOrderUiState.DRAFT_READY, label: PURCHASE_ORDER_UI_STATE_LABELS.DRAFT_READY },
		{ value: PurchaseOrderStatus.CONFIRMED, label: PURCHASE_ORDER_STATUS_LABELS.CONFIRMED },
		{ value: PurchaseOrderStatus.CANCELLED, label: PURCHASE_ORDER_STATUS_LABELS.CANCELLED }
	];
	const sortFieldOptions: { value: PurchaseOrderSortField; label: string }[] = [
		{ value: 'orderNumber', label: 'N.º orden' },
		{ value: 'orderDate', label: 'Fecha orden' },
		{ value: 'createdAt', label: 'Fecha creación' },
		{ value: 'status', label: 'Estado' }
	];

	const activeFilterCount = $derived(
		(statusFilter !== '' ? 1 : 0) +
			(supplierFilter !== '' ? 1 : 0) +
			(pendingBalanceFilter ? 1 : 0) +
			(overdueBalanceFilter ? 1 : 0) +
			(orderBy !== 'orderNumber' ? 1 : 0) +
			(orderSort !== 'desc' ? 1 : 0)
	);

	const selectClass =
		'rounded-lg border-none bg-surface-container-high px-3 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';
	const inputClass =
		'w-full rounded-lg border-none bg-surface-container-high p-3 pl-11 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';
	const toggleButtonClass = (active: boolean, activeClass: string) =>
		`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${active ? activeClass : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`;
</script>

<section class="glass-card min-w-0 bg-surface-container-low p-3 lg:p-4">
	<!-- Search row: always visible on all screens -->
	<div class="flex items-center gap-2">
		<div class="relative min-w-0 flex-1">
			<Search class="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-outline" />
			<input
				id="purchase-orders-search"
				name="purchase-orders-search"
				type="search"
				value={search}
				oninput={(e) => onSearch(e.currentTarget.value)}
				placeholder="Buscar por PO-0001, documento o proveedor..."
				class={inputClass}
			/>
		</div>

		<!-- Mobile filter toggle -->
		<button
			type="button"
			onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}
			class="inline-flex h-12 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors lg:hidden {activeFilterCount >
			0
				? 'bg-brand-blue text-white'
				: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
			aria-expanded={mobileFiltersOpen}
			aria-label="Mostrar filtros"
		>
			<SlidersHorizontal class="h-4 w-4" />
			<span>Filtros</span>
			{#if activeFilterCount > 0}
				<span
					class="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/25 px-1.5 text-xs font-bold"
				>
					{activeFilterCount}
				</span>
			{/if}
			<ChevronDown class="h-4 w-4 transition-transform {mobileFiltersOpen ? 'rotate-180' : ''}" />
		</button>

		<!-- Clear button: visible on all screens -->
		<button
			type="button"
			onclick={onClearFilters}
			disabled={!hasActiveFilters}
			class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 lg:h-12 lg:w-12 {hasActiveFilters
				? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
				: 'bg-surface-container-high text-outline'}"
			aria-label="Limpiar filtros"
			title="Limpiar filtros"
		>
			<RotateCcw class="h-4 w-4" />
		</button>
	</div>

	<!-- Desktop filters: always visible on lg+ -->
	<div class="mt-3 hidden flex-wrap items-center gap-2 lg:flex">
		<select
			id="purchase-status-filter"
			name="purchase-status-filter"
			value={statusFilter}
			onchange={(e) => onStatusChange(e.currentTarget.value as PurchaseOrderStatusFilter)}
			class="{selectClass} min-w-[8rem] flex-1"
		>
			<option value="">Estado</option>
			{#each statusFilterOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>

		<select
			id="purchase-supplier-filter"
			name="purchase-supplier-filter"
			value={supplierFilter}
			onchange={(e) => onSupplierChange(e.currentTarget.value)}
			class="{selectClass} min-w-[10rem] flex-[1.5]"
		>
			<option value="">Proveedor</option>
			{#each suppliers as supplier (supplier.id)}
				<option value={supplier.id}>{supplier.name}</option>
			{/each}
		</select>

		<button
			type="button"
			onclick={onTogglePending}
			class={toggleButtonClass(pendingBalanceFilter, 'bg-brand-navy text-white')}
			title={pendingBalanceFilter
				? 'Mostrando solo con saldo pendiente'
				: 'Mostrar solo con saldo pendiente'}
		>
			<Wallet class="h-4 w-4" />
			Pendiente
		</button>

		<button
			type="button"
			onclick={onToggleOverdue}
			class={toggleButtonClass(overdueBalanceFilter, 'bg-error-container text-on-error-container')}
			title={overdueBalanceFilter ? 'Mostrando solo vencidas' : 'Mostrar solo vencidas'}
		>
			<TriangleAlert class="h-4 w-4" />
			Vencidas
		</button>

		<div class="flex min-w-0 flex-1 items-center gap-2">
			<select
				id="purchase-order-sort-field"
				name="purchase-order-sort-field"
				value={orderBy}
				onchange={(e) => onSortFieldChange(e.currentTarget.value as PurchaseOrderSortField)}
				class="{selectClass} min-w-0 flex-1"
				aria-label="Ordenar órdenes de compra por"
			>
				{#each sortFieldOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>

			<button
				type="button"
				onclick={onToggleSortDirection}
				class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-surface-container-high text-brand-navy transition-colors hover:bg-surface-container-highest"
				aria-label={orderSort === 'desc' ? 'Orden descendente' : 'Orden ascendente'}
				title={orderSort === 'desc' ? 'Descendente' : 'Ascendente'}
			>
				{#if orderSort === 'desc'}
					<ArrowDownWideNarrow class="h-4 w-4" />
				{:else}
					<ArrowUpWideNarrow class="h-4 w-4" />
				{/if}
			</button>
		</div>
	</div>

	<!-- Mobile collapsible filters -->
	{#if mobileFiltersOpen}
		<div class="mt-3 grid grid-cols-2 gap-3 lg:hidden">
			<select
				id="purchase-status-filter-mobile"
				name="purchase-status-filter-mobile"
				value={statusFilter}
				onchange={(e) => onStatusChange(e.currentTarget.value as PurchaseOrderStatusFilter)}
				class={selectClass}
			>
				<option value="">Estado</option>
				{#each statusFilterOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>

			<select
				id="purchase-supplier-filter-mobile"
				name="purchase-supplier-filter-mobile"
				value={supplierFilter}
				onchange={(e) => onSupplierChange(e.currentTarget.value)}
				class={selectClass}
			>
				<option value="">Proveedor</option>
				{#each suppliers as supplier (supplier.id)}
					<option value={supplier.id}>{supplier.name}</option>
				{/each}
			</select>

			<button
				type="button"
				onclick={onTogglePending}
				class={toggleButtonClass(pendingBalanceFilter, 'bg-brand-navy text-white')}
				title={pendingBalanceFilter
					? 'Mostrando solo con saldo pendiente'
					: 'Mostrar solo con saldo pendiente'}
			>
				<Wallet class="h-4 w-4" />
				Pendiente
			</button>

			<button
				type="button"
				onclick={onToggleOverdue}
				class={toggleButtonClass(
					overdueBalanceFilter,
					'bg-error-container text-on-error-container'
				)}
				title={overdueBalanceFilter ? 'Mostrando solo vencidas' : 'Mostrar solo vencidas'}
			>
				<TriangleAlert class="h-4 w-4" />
				Vencidas
			</button>

			<select
				id="purchase-order-sort-field-mobile"
				name="purchase-order-sort-field-mobile"
				value={orderBy}
				onchange={(e) => onSortFieldChange(e.currentTarget.value as PurchaseOrderSortField)}
				class={selectClass}
				aria-label="Ordenar por"
			>
				{#each sortFieldOptions as option (option.value)}
					<option value={option.value}>{option.label}</option>
				{/each}
			</select>

			<button
				type="button"
				onclick={onToggleSortDirection}
				class="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-surface-container-high text-brand-navy transition-colors hover:bg-surface-container-highest"
				aria-label={orderSort === 'desc' ? 'Orden descendente' : 'Orden ascendente'}
				title={orderSort === 'desc' ? 'Descendente' : 'Ascendente'}
			>
				{#if orderSort === 'desc'}
					<ArrowDownWideNarrow class="h-4 w-4" />
					<span class="text-sm">Descendente</span>
				{:else}
					<ArrowUpWideNarrow class="h-4 w-4" />
					<span class="text-sm">Ascendente</span>
				{/if}
			</button>
		</div>
	{/if}
</section>
