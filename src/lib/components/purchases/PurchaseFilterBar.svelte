<script lang="ts">
	import {
		ArrowDownWideNarrow,
		ArrowUpWideNarrow,
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
		'rounded-lg border-none bg-surface-container-high px-3 py-2 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';
</script>

<section class="glass-card min-w-0 bg-surface-container-low p-2 lg:p-3">
	<!-- Row 1: Search + quick filters -->
	<div class="flex flex-wrap items-center gap-2">
		<div class="relative min-w-0 flex-[3] basis-48">
			<Search class="absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-outline" />
			<input
				id="purchase-orders-search"
				name="purchase-orders-search"
				type="search"
				value={search}
				oninput={(e) => onSearch(e.currentTarget.value)}
				placeholder="Buscar por PO-0001, documento o proveedor..."
				class="w-full rounded-lg border-none bg-surface-container-high p-2 pl-9 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0"
			/>
		</div>

		<select
			id="purchase-status-filter"
			value={statusFilter}
			onchange={(e) => onStatusChange(e.currentTarget.value as PurchaseOrderStatusFilter)}
			class="{selectClass} w-32 hidden lg:inline-block"
		>
			<option value="">Estado</option>
			{#each statusFilterOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>

		<select
			id="purchase-supplier-filter"
			value={supplierFilter}
			onchange={(e) => onSupplierChange(e.currentTarget.value)}
			class="{selectClass} w-36 hidden lg:inline-block"
		>
			<option value="">Proveedor</option>
			{#each suppliers as supplier (supplier.id)}
				<option value={supplier.id}>{supplier.name}</option>
			{/each}
		</select>

		<button
			type="button"
			onclick={onTogglePending}
			class="h-9 hidden lg:inline-flex items-center justify-center rounded-lg xl:px-2.5 xl:gap-1.5 transition-colors {pendingBalanceFilter
				? 'bg-brand-navy text-white'
				: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
			title="Filtrar por saldo pendiente"
		>
			<Wallet class="h-3.5 w-3.5" />
			<span class="hidden xl:inline text-[13px]">Pendiente</span>
		</button>

		<button
			type="button"
			onclick={onToggleOverdue}
			class="h-9 hidden lg:inline-flex items-center justify-center rounded-lg xl:px-2.5 xl:gap-1.5 transition-colors {overdueBalanceFilter
				? 'bg-error-container text-on-error-container'
				: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
			title="Filtrar por vencidas"
		>
			<TriangleAlert class="h-3.5 w-3.5" />
			<span class="hidden xl:inline text-[13px]">Vencidas</span>
		</button>

		<select
			id="purchase-order-sort-field"
			value={orderBy}
			onchange={(e) => onSortFieldChange(e.currentTarget.value as PurchaseOrderSortField)}
			class="{selectClass} w-32 hidden lg:inline-block"
			aria-label="Ordenar por"
		>
			{#each sortFieldOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>

		<button
			type="button"
			onclick={onToggleSortDirection}
			class="h-9 w-9 hidden lg:inline-flex items-center justify-center rounded-lg bg-surface-container-high text-brand-navy transition-colors hover:bg-surface-container-highest"
			aria-label={orderSort === 'desc' ? 'Orden descendente' : 'Orden ascendente'}
		>
			{#if orderSort === 'desc'}
				<ArrowDownWideNarrow class="h-3.5 w-3.5" />
			{:else}
				<ArrowUpWideNarrow class="h-3.5 w-3.5" />
			{/if}
		</button>

		<button
			type="button"
			onclick={onClearFilters}
			disabled={!hasActiveFilters}
			class="h-9 w-9 hidden lg:inline-flex items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 {hasActiveFilters
				? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
				: 'bg-surface-container-high text-outline'}"
			aria-label="Limpiar filtros"
		>
			<RotateCcw class="h-3.5 w-3.5" />
		</button>

		<button
			type="button"
			onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}
			class="relative inline-flex lg:hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors {activeFilterCount >
			0
				? 'bg-brand-blue text-white'
				: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
			aria-expanded={mobileFiltersOpen}
			aria-label="Mostrar filtros"
		>
			<SlidersHorizontal class="h-3.5 w-3.5" />
			{#if activeFilterCount > 0}
				<span
					class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gold px-1 text-[9px] font-bold text-brand-navy"
				>
					{activeFilterCount}
				</span>
			{/if}
		</button>
	</div>

	<!-- Mobile collapsible filters -->
	{#if mobileFiltersOpen}
		<div class="mt-2 grid grid-cols-2 gap-2 lg:hidden">
			<select
				id="purchase-status-filter-m"
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
				id="purchase-supplier-filter-m"
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
				class="flex h-9 items-center justify-center rounded-lg transition-colors {pendingBalanceFilter
					? 'bg-brand-navy text-white'
					: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
			>
				<Wallet class="h-3.5 w-3.5" />
				<span class="ml-1 text-sm">Pendiente</span>
			</button>

			<button
				type="button"
				onclick={onToggleOverdue}
				class="flex h-9 items-center justify-center rounded-lg transition-colors {overdueBalanceFilter
					? 'bg-error-container text-on-error-container'
					: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
			>
				<TriangleAlert class="h-3.5 w-3.5" />
				<span class="ml-1 text-sm">Vencidas</span>
			</button>

			<select
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
				class="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-surface-container-high text-sm font-medium text-brand-navy transition-colors hover:bg-surface-container-highest"
			>
				{#if orderSort === 'desc'}
					<ArrowDownWideNarrow class="h-3.5 w-3.5" />
				{:else}
					<ArrowUpWideNarrow class="h-3.5 w-3.5" />
				{/if}
				{orderSort === 'desc' ? 'Descendente' : 'Ascendente'}
			</button>
		</div>
	{/if}
</section>
