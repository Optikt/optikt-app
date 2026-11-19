<script lang="ts">
	import { getContext } from 'svelte';
	import SaleListHeader from '$lib/components/sales/SaleListHeader.svelte';
	import SaleMobileControls from '$lib/components/sales/SaleMobileControls.svelte';
	import SaleStatusTabs from '$lib/components/sales/SaleStatusTabs.svelte';
	import SaleFilterChips from '$lib/components/sales/SaleFilterChips.svelte';
	import SaleListFooter from '$lib/components/sales/SaleListFooter.svelte';
	import QuoteKpiCards from './QuoteKpiCards.svelte';
	import QuotesGridView from './QuotesGridView.svelte';
	import QuoteListEmpty from './QuoteListEmpty.svelte';
	import { QUOTE_LIST_KEY, type QuoteListContext } from './quoteListContext';
	import { LIST_QUOTE_STATUSES } from './quoteListParams';
	import { QUOTE_STATUS_LABELS, type QuoteStatus } from '$lib/shared/contracts/quotes';

	/**
	 * Plantilla móvil del listado (<700px de contenedor) — mismas piezas que
	 * ventas: KPIs en carrusel, buscador+Filtros sticky, pestañas/chips con
	 * scroll, tarjetas Lista (densa) / Cuadros (rica), pie con selección
	 * plegable + paginación ‹ ›. Las hojas viven en `QuoteMobileOverlays`.
	 */
	const ctx: QuoteListContext = getContext(QUOTE_LIST_KEY);
</script>

<SaleListHeader
	totalCount={ctx.stats.total}
	view={ctx.view}
	canCreate={ctx.canAct}
	narrow
	onViewChange={ctx.handlers.onViewChange}
	title="Presupuestos"
	countNounOne="presupuesto registrado"
	countNounMany="presupuestos registrados"
/>

<QuoteKpiCards stats={ctx.stats} onSelect={ctx.handlers.onKpiSelect} narrow />

<SaleMobileControls
	search={ctx.search}
	activeCount={ctx.chips.length}
	filtersOpen={ctx.mobileUi.filtersOpen}
	onSearch={ctx.handlers.onSearch}
	onOpenFilters={ctx.handlers.openMobileFilters}
	placeholder="Buscar cliente, vendedor o #…"
	ariaLabel="Buscar presupuestos"
	inputId="quotes-search-mobile"
/>

<SaleStatusTabs
	statuses={LIST_QUOTE_STATUSES}
	labels={QUOTE_STATUS_LABELS}
	counts={ctx.facets}
	value={ctx.statuses}
	scroll
	onchange={(next) => ctx.handlers.onStatusesChange(next as QuoteStatus[])}
	allLabel="Todos"
/>

<SaleFilterChips chips={ctx.chips} scroll onClear={ctx.handlers.onClearFilters} />

<p class="sr-only" aria-live="polite">{ctx.quotesData.total} presupuestos</p>

{#if ctx.loading && ctx.quotesData.quotes.length === 0}
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
{:else if ctx.quotesData.quotes.length === 0}
	<div class="rounded-[var(--ds-radius-lg)] bg-white shadow-[var(--ds-shadow-sm)]">
		<QuoteListEmpty
			hasFilters={ctx.chips.length > 0 || ctx.search.trim().length > 0}
			onClearFilters={ctx.handlers.onClearFilters}
		/>
	</div>
{:else}
	<div
		class="flex flex-col gap-2 {ctx.loading ? 'pointer-events-none opacity-60' : ''}"
		aria-busy={ctx.loading}
	>
		<QuotesGridView
			quotes={ctx.quotesData.quotes}
			canManage={ctx.canAct}
			density={ctx.view === 'list' ? 'compact' : 'comfortable'}
			onOpen={ctx.handlers.onOpen}
			onEdit={ctx.handlers.onEdit}
			onDuplicate={ctx.handlers.onDuplicate}
			onConvert={ctx.handlers.onConvert}
			onCancel={ctx.handlers.onCancelRequest}
			onMenu={ctx.handlers.openMobileActions}
		/>
	</div>

	<SaleListFooter
		page={ctx.quotesData.page}
		perPage={ctx.quotesData.perPage}
		total={ctx.quotesData.total}
		totalPages={ctx.quotesData.totalPages}
		selection={ctx.quotesData.selection}
		showPerPage={false}
		narrow
		onPageChange={(next) => ctx.handlers.onPageChange(next, { scrollTop: true })}
		onPerPageChange={ctx.handlers.onPerPageChange}
		unitNounOne="presupuesto"
		unitNounMany="presupuestos"
	/>
{/if}
