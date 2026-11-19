<script lang="ts">
	import { getContext } from 'svelte';
	import SaleListHeader from './SaleListHeader.svelte';
	import SaleKpiCards from './SaleKpiCards.svelte';
	import SaleFilterBar from './SaleFilterBar.svelte';
	import SaleStatusTabs from './SaleStatusTabs.svelte';
	import SaleFilterChips from './SaleFilterChips.svelte';
	import SalesListView from './SalesListView.svelte';
	import SalesGridView from './SalesGridView.svelte';
	import SaleListFooter from './SaleListFooter.svelte';
	import SaleListEmpty from './SaleListEmpty.svelte';
	import { SALE_LIST_KEY, type SaleListContext } from './saleListContext';
	import type { SaleListSort } from './listParams';

	/**
	 * Plantilla de escritorio del listado de ventas (≥700px de contenedor).
	 * Estado y handlers via el contexto compartido con la plantilla móvil.
	 */
	const ctx: SaleListContext = getContext(SALE_LIST_KEY);
</script>

<SaleListHeader
	totalCount={ctx.stats.total}
	view={ctx.view}
	canCreate={ctx.canAct}
	onViewChange={ctx.handlers.onViewChange}
/>

<SaleKpiCards stats={ctx.stats} onSelect={ctx.handlers.onKpiSelect} />

<section
	class="flex flex-col gap-2.5 rounded-[var(--ds-radius-lg)] bg-white p-2.5 shadow-[var(--ds-shadow-sm)] lg:p-3"
>
	<SaleFilterBar
		search={ctx.search}
		sellerId={ctx.sellerId}
		sellers={ctx.sellers}
		preset={ctx.preset}
		from={ctx.from}
		to={ctx.to}
		sort={ctx.sort}
		toggles={{
			cashea: ctx.cashea,
			shippingPending: ctx.shippingPending,
			freeItem: ctx.freeItem,
			balance: ctx.balance
		}}
		activeToggleCount={ctx.activeToggleCount}
		onSearch={ctx.handlers.onSearch}
		onSellerChange={ctx.handlers.onSellerChange}
		onPresetChange={ctx.handlers.onPresetChange}
		onRangeChange={ctx.handlers.onRangeChange}
		onToggle={ctx.handlers.onToggle}
		onSortChange={(next) => ctx.handlers.onSortChange(next as SaleListSort)}
	/>

	<SaleStatusTabs
		counts={ctx.salesData.facets}
		value={ctx.statuses}
		onchange={ctx.handlers.onStatusesChange}
	/>

	<SaleFilterChips chips={ctx.chips} onClear={ctx.handlers.onClearFilters} />
</section>

<p class="sr-only" aria-live="polite">{ctx.salesData.total} ventas</p>

<div
	class="overflow-hidden rounded-[var(--ds-radius-lg)] bg-white shadow-[var(--ds-shadow-sm)] {ctx.loading &&
	ctx.salesData.sales.length > 0
		? 'pointer-events-none opacity-60'
		: ''}"
	aria-busy={ctx.loading}
>
	{#if ctx.loading && ctx.salesData.sales.length === 0}
		{#if ctx.view === 'list'}
			<div class="h-[38px] border-b border-outline-variant/70 bg-surface-container-low"></div>
			{#each Array(7) as _, i (i)}
				<div class="flex h-[58px] items-center gap-4 border-b border-outline-variant/40 px-3">
					<div class="h-3 w-16 animate-pulse rounded bg-surface-container-high"></div>
					<div class="h-3 w-40 animate-pulse rounded bg-surface-container-high"></div>
					<div class="h-3 w-20 animate-pulse rounded bg-surface-container-high"></div>
					<div class="h-3 w-16 animate-pulse rounded bg-surface-container-high"></div>
					<div class="h-3 w-32 animate-pulse rounded bg-surface-container-high"></div>
				</div>
			{/each}
		{:else}
			<div class="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{#each Array(6) as _, i (i)}
					<div
						class="h-[132px] animate-pulse rounded-[var(--ds-radius-lg)] bg-surface-container-high"
					></div>
				{/each}
			</div>
		{/if}
	{:else if ctx.salesData.sales.length === 0}
		<SaleListEmpty
			totalSales={ctx.stats.total}
			hasFilters={ctx.chips.length > 0 || ctx.search.trim().length > 0}
			onClearFilters={ctx.handlers.onClearFilters}
		/>
	{:else}
		{#if ctx.view === 'list'}
			<div class="p-3">
				<SalesListView
					sales={ctx.salesData.sales}
					canManage={ctx.canAct}
					currentUserId={ctx.user.id}
					currentUserRole={ctx.user.role}
					onOpen={ctx.handlers.onOpenSale}
					onCancel={ctx.handlers.onCancelRequest}
				/>
			</div>
		{:else}
			<div class="p-3">
				<SalesGridView
					sales={ctx.salesData.sales}
					canManage={ctx.canAct}
					currentUserId={ctx.user.id}
					currentUserRole={ctx.user.role}
					onOpen={ctx.handlers.onOpenSale}
					onCancel={ctx.handlers.onCancelRequest}
				/>
			</div>
		{/if}

		<SaleListFooter
			page={ctx.salesData.page}
			perPage={ctx.salesData.perPage}
			total={ctx.salesData.total}
			totalPages={ctx.salesData.totalPages}
			selection={ctx.salesData.selection}
			showPerPage={ctx.view === 'list'}
			onPageChange={(next) => ctx.handlers.onPageChange(next)}
			onPerPageChange={ctx.handlers.onPerPageChange}
		/>
	{/if}
</div>
