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
</script>

<section class="glass-card min-w-0 bg-surface-container-low p-2 lg:p-3">
	<!-- Single row: search + filters compact -->
	<div class="flex flex-wrap items-center gap-2">
		<div class="relative min-w-0 flex-1">
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

		<!-- Desktop filters: visible on sm+ -->
		<select
			id="purchase-status-filter"
			name="purchase-status-filter"
			value={statusFilter}
			onchange={(e) => onStatusChange(e.currentTarget.value as PurchaseOrderStatusFilter)}
			class="hidden rounded-lg border-none bg-surface-container-high px-2.5 py-2 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 sm:inline-block"
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
			class="hidden rounded-lg border-none bg-surface-container-high px-2.5 py-2 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 sm:inline-block"
		>
			<option value="">Proveedor</option>
			{#each suppliers as supplier (supplier.id)}
				<option value={supplier.id}>{supplier.name}</option>
			{/each}
		</select>

		<button
			type="button"
			onclick={onTogglePending}
			class="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors sm:inline-flex {pendingBalanceFilter
				? 'bg-brand-navy text-white'
				: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
		>
			<Wallet class="h-3.5 w-3.5" />
			Pendiente
		</button>

		<button
			type="button"
			onclick={onToggleOverdue}
			class="hidden h-9 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors sm:inline-flex {overdueBalanceFilter
				? 'bg-error-container text-on-error-container'
				: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
		>
			<TriangleAlert class="h-3.5 w-3.5" />
			Vencidas
		</button>

		<select
			id="purchase-order-sort-field"
			name="purchase-order-sort-field"
			value={orderBy}
			onchange={(e) => onSortFieldChange(e.currentTarget.value as PurchaseOrderSortField)}
			class="hidden rounded-lg border-none bg-surface-container-high px-2.5 py-2 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 sm:inline-block"
			aria-label="Ordenar por"
		>
			{#each sortFieldOptions as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>

		<button
			type="button"
			onclick={onToggleSortDirection}
			class="hidden h-9 w-9 items-center justify-center rounded-lg bg-surface-container-high text-brand-navy transition-colors hover:bg-surface-container-highest sm:inline-flex"
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
			class="h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 inline-flex {hasActiveFilters
				? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
				: 'bg-surface-container-high text-outline'}"
			aria-label="Limpiar filtros"
		>
			<RotateCcw class="h-3.5 w-3.5" />
		</button>

		<!-- Mobile filter toggle -->
		<button
			type="button"
			onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}
			class="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors sm:hidden {activeFilterCount >
			0
				? 'bg-brand-blue text-white'
				: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
			aria-expanded={mobileFiltersOpen}
		>
			<SlidersHorizontal class="h-3.5 w-3.5" />
			Filtros
			{#if activeFilterCount > 0}
				<span
					class="flex h-4 min-w-4 items-center justify-center rounded-full bg-white/25 px-1 text-[10px] font-bold"
				>
					{activeFilterCount}
				</span>
			{/if}
		</button>
	</div>

	<!-- Mobile collapsible filters -->
	{#if mobileFiltersOpen}
		<div class="mt-2 grid grid-cols-2 gap-2 sm:hidden">
			<select
				id="purchase-status-filter-m"
				value={statusFilter}
				onchange={(e) => onStatusChange(e.currentTarget.value as PurchaseOrderStatusFilter)}
				class="rounded-lg border-none bg-surface-container-high px-2.5 py-2 text-sm font-medium text-on-surface focus:border-l-2 focus:border-l-brand-blue focus:ring-0"
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
				class="rounded-lg border-none bg-surface-container-high px-2.5 py-2 text-sm font-medium text-on-surface focus:border-l-2 focus:border-l-brand-blue focus:ring-0"
			>
				<option value="">Proveedor</option>
				{#each suppliers as supplier (supplier.id)}
					<option value={supplier.id}>{supplier.name}</option>
				{/each}
			</select>

			<button
				type="button"
				onclick={onTogglePending}
				class="flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors {pendingBalanceFilter
					? 'bg-brand-navy text-white'
					: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
			>
				<Wallet class="h-3.5 w-3.5" />
				Pendiente
			</button>

			<button
				type="button"
				onclick={onToggleOverdue}
				class="flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors {overdueBalanceFilter
					? 'bg-error-container text-on-error-container'
					: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
			>
				<TriangleAlert class="h-3.5 w-3.5" />
				Vencidas
			</button>

			<select
				value={orderBy}
				onchange={(e) => onSortFieldChange(e.currentTarget.value as PurchaseOrderSortField)}
				class="rounded-lg border-none bg-surface-container-high px-2.5 py-2 text-sm font-medium text-on-surface focus:border-l-2 focus:border-l-brand-blue focus:ring-0"
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
