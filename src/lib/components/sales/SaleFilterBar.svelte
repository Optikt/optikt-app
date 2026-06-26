<script lang="ts">
	import { RotateCcw, Search, SlidersHorizontal, Sparkles, Truck } from '@lucide/svelte';
	import { ALL_SALE_STATUSES, SALE_STATUS_LABELS, type SaleStatus } from '$lib/shared/enums';

	interface Props {
		search: string;
		statusFilter: SaleStatus | '';
		shippingPendingFilter: boolean;
		hasFreeItemFilter: boolean;
		hasActiveFilters: boolean;
		onSearch: (value: string) => void;
		onStatusChange: (value: string) => void;
		onToggleShippingPending: () => void;
		onToggleFreeItem: () => void;
		onClearFilters: () => void;
	}

	let {
		search,
		statusFilter,
		shippingPendingFilter,
		hasFreeItemFilter,
		hasActiveFilters,
		onSearch,
		onStatusChange,
		onToggleShippingPending,
		onToggleFreeItem,
		onClearFilters
	}: Props = $props();

	let mobileFiltersOpen = $state(false);

	const activeFilterCount = $derived(
		(statusFilter !== '' ? 1 : 0) + (shippingPendingFilter ? 1 : 0) + (hasFreeItemFilter ? 1 : 0)
	);

	const selectClass =
		'rounded-lg border-none bg-surface-container-high px-3 py-3 text-sm font-medium text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';
	const inputClass =
		'w-full rounded-lg border-none bg-surface-container-high p-3 pl-11 text-sm text-on-surface transition-colors placeholder:text-outline focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';
	const toggleButtonClass = (active: boolean, activeClass: string) =>
		`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${active ? activeClass : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}`;
</script>

<section class="glass-card min-w-0 bg-surface-container-low p-3 lg:p-4">
	<!-- Single flex-wrap row: search + filters + toggle + clear -->
	<div class="flex flex-wrap items-center gap-2">
		<div class="relative min-w-0 flex-1 basis-48">
			<Search class="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-outline" />
			<input
				id="sales-search"
				name="sales-search"
				type="search"
				value={search}
				oninput={(e) => onSearch(e.currentTarget.value)}
				placeholder="Buscar por cliente, vendedor o # de orden..."
				class={inputClass}
			/>
		</div>

		<!-- Desktop inline filters -->
		<div class="mt-0 hidden flex-wrap items-center gap-2 lg:flex">
			<select
				id="sales-status-filter"
				name="sales-status-filter"
				value={statusFilter}
				onchange={(e) => onStatusChange(e.currentTarget.value)}
				class="{selectClass} min-w-[10rem] flex-1"
			>
				<option value="">Todos los estados</option>
				{#each ALL_SALE_STATUSES as s (s)}
					<option value={s}>{SALE_STATUS_LABELS[s]}</option>
				{/each}
			</select>

			<button
				type="button"
				onclick={onToggleShippingPending}
				class={toggleButtonClass(
					shippingPendingFilter,
					'bg-warning-container text-on-warning-container'
				)}
				title="Filtrar ventas con envío pendiente"
			>
				<Truck class="h-4 w-4" />
				Envío pendiente
			</button>

			<button
				type="button"
				onclick={onToggleFreeItem}
				class={toggleButtonClass(hasFreeItemFilter, 'bg-amber-100 text-amber-700')}
				title="Filtrar ventas con ítems libres"
			>
				<Sparkles class="h-4 w-4" />
				Ítem libre
			</button>
		</div>

		<!-- Mobile filter toggle (icon only) -->
		<button
			type="button"
			onclick={() => (mobileFiltersOpen = !mobileFiltersOpen)}
			class="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors lg:hidden {activeFilterCount >
			0
				? 'bg-brand-blue text-white'
				: 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest'}"
			aria-expanded={mobileFiltersOpen}
			aria-label="Mostrar filtros"
		>
			<SlidersHorizontal class="h-4 w-4" />
			{#if activeFilterCount > 0}
				<span
					class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-gold px-1 text-[9px] font-bold text-brand-navy"
				>
					{activeFilterCount}
				</span>
			{/if}
		</button>

		<!-- Clear button -->
		<button
			type="button"
			onclick={onClearFilters}
			disabled={!hasActiveFilters}
			class="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 {hasActiveFilters
				? 'bg-brand-navy text-white hover:bg-brand-navy-dark'
				: 'bg-surface-container-high text-outline'}"
			aria-label="Limpiar filtros"
			title="Limpiar filtros"
		>
			<RotateCcw class="h-4 w-4" />
		</button>
	</div>

	<!-- Mobile collapsible filters -->
	{#if mobileFiltersOpen}
		<div class="mt-3 space-y-2 lg:hidden">
			<select
				id="sales-status-filter-mobile"
				name="sales-status-filter-mobile"
				value={statusFilter}
				onchange={(e) => onStatusChange(e.currentTarget.value)}
				class="{selectClass} w-full"
			>
				<option value="">Todos los estados</option>
				{#each ALL_SALE_STATUSES as s (s)}
					<option value={s}>{SALE_STATUS_LABELS[s]}</option>
				{/each}
			</select>

			<div class="flex flex-wrap gap-2">
				<button
					type="button"
					onclick={onToggleShippingPending}
					class={toggleButtonClass(
						shippingPendingFilter,
						'bg-warning-container text-on-warning-container'
					)}
					title="Filtrar ventas con envío pendiente"
				>
					<Truck class="h-4 w-4" />
					Envío pendiente
				</button>

				<button
					type="button"
					onclick={onToggleFreeItem}
					class={toggleButtonClass(hasFreeItemFilter, 'bg-amber-100 text-amber-700')}
					title="Filtrar ventas con ítems libres"
				>
					<Sparkles class="h-4 w-4" />
					Ítem libre
				</button>
			</div>
		</div>
	{/if}
</section>
