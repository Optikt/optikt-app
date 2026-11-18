<script lang="ts">
	import { getContext } from 'svelte';
	import SaleListHeader from './SaleListHeader.svelte';
	import SaleKpiCards from './SaleKpiCards.svelte';
	import SaleMobileControls from './SaleMobileControls.svelte';
	import SaleStatusTabs from './SaleStatusTabs.svelte';
	import SaleFilterChips from './SaleFilterChips.svelte';
	import SalesGridView from './SalesGridView.svelte';
	import SaleListFooter from './SaleListFooter.svelte';
	import SaleListEmpty from './SaleListEmpty.svelte';
	import { SALE_LIST_KEY, type SaleListContext } from './saleListContext';

	/**
	 * Plantilla móvil del listado (<700px de contenedor): KPIs en carrusel,
	 * buscador+Filtros sticky, pestañas/chips desplazables, vistas Lista (densa)
	 * y Cuadros (rica), pie con resumen de selección + paginación ‹ ›.
	 * Las hojas (filtros y acciones del ⋯) viven en `SaleMobileOverlays` —
	 * FUERA del contenedor `@container` (fixed + containment son incompatibles).
	 */
	const ctx: SaleListContext = getContext(SALE_LIST_KEY);
</script>

<SaleListHeader
	totalCount={ctx.stats.total}
	view={ctx.view}
	canCreate={ctx.canAct}
	narrow
	onViewChange={ctx.handlers.onViewChange}
/>

<SaleKpiCards stats={ctx.stats} onSelect={ctx.handlers.onKpiSelect} narrow />

<SaleMobileControls
	search={ctx.search}
	activeCount={ctx.chips.length}
	filtersOpen={ctx.mobileUi.filtersOpen}
	onSearch={ctx.handlers.onSearch}
	onOpenFilters={ctx.handlers.openMobileFilters}
/>

<SaleStatusTabs
	counts={ctx.salesData.facets}
	value={ctx.statuses}
	scroll
	onchange={ctx.handlers.onStatusesChange}
/>

<SaleFilterChips chips={ctx.chips} scroll onClear={ctx.handlers.onClearFilters} />

<p class="sr-only" aria-live="polite">{ctx.salesData.total} ventas</p>

{#if ctx.loading && ctx.salesData.sales.length === 0}
	<!-- Skeletons de tarjeta (pulso) que NO tapan filtros ni KPIs -->
	<div class="flex flex-col gap-2" aria-busy={ctx.loading}>
		{#each Array(6) as _, i (i)}
			<div
				class="h-[88px] animate-pulse rounded-[var(--ds-radius-lg)] bg-white p-3 shadow-[var(--ds-shadow-sm)]"
			>
				<div class="h-3 w-2/5 animate-pulse rounded bg-surface-container-high"></div>
				<div class="mt-2 h-3 w-3/5 animate-pulse rounded bg-surface-container-high"></div>
				<div class="mt-2 h-3 w-1/4 animate-pulse rounded bg-surface-container-high"></div>
			</div>
		{/each}
	</div>
{:else if ctx.salesData.sales.length === 0}
	<div class="rounded-[var(--ds-radius-lg)] bg-white shadow-[var(--ds-shadow-sm)]">
		<SaleListEmpty
			totalSales={ctx.stats.total}
			hasFilters={ctx.chips.length > 0 || ctx.search.trim().length > 0}
			onClearFilters={ctx.handlers.onClearFilters}
		/>
	</div>
{:else}
	<div
		class="flex flex-col gap-2 {ctx.loading ? 'pointer-events-none opacity-60' : ''}"
		aria-busy={ctx.loading}
	>
		<SalesGridView
			sales={ctx.salesData.sales}
			canManage={ctx.canAct}
			density={ctx.view === 'list' ? 'compact' : 'comfortable'}
			currentUserId={ctx.user.id}
			currentUserRole={ctx.user.role}
			onOpen={ctx.handlers.onOpenSale}
			onCancel={ctx.handlers.onCancelRequest}
			onMenu={ctx.handlers.openMobileActions}
		/>
	</div>

	<SaleListFooter
		page={ctx.salesData.page}
		perPage={ctx.salesData.perPage}
		total={ctx.salesData.total}
		totalPages={ctx.salesData.totalPages}
		selection={ctx.salesData.selection}
		showPerPage={false}
		narrow
		onPageChange={(next) => ctx.handlers.onPageChange(next, { scrollTop: true })}
		onPerPageChange={ctx.handlers.onPerPageChange}
	/>
{/if}
