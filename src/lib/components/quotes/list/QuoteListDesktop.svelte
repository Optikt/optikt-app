<script lang="ts">
	import { getContext } from 'svelte';
	import SaleListHeader from '$lib/components/sales/SaleListHeader.svelte';
	import SaleFilterBar from '$lib/components/sales/SaleFilterBar.svelte';
	import SaleStatusTabs from '$lib/components/sales/SaleStatusTabs.svelte';
	import SaleFilterChips from '$lib/components/sales/SaleFilterChips.svelte';
	import SaleListFooter from '$lib/components/sales/SaleListFooter.svelte';
	import QuoteKpiCards from './QuoteKpiCards.svelte';
	import QuotesListView from './QuotesListView.svelte';
	import QuotesGridView from './QuotesGridView.svelte';
	import QuoteListEmpty from './QuoteListEmpty.svelte';
	import {
		QUOTE_LIST_KEY,
		QUOTE_LIST_SORT_OPTIONS,
		QUOTE_LIST_TOGGLES,
		type QuoteListContext
	} from './quoteListContext';
	import { LIST_QUOTE_STATUSES, type QuoteListSort } from './quoteListParams';
	import { QUOTE_STATUS_LABELS, type QuoteStatus } from '$lib/shared/contracts/quotes';

	/** Plantilla de escritorio (≥700px de contenedor); estado vía contexto compartido. */
	const ctx: QuoteListContext = getContext(QUOTE_LIST_KEY);
</script>

<SaleListHeader
	totalCount={ctx.stats.total}
	view={ctx.view}
	canCreate={ctx.canAct}
	onViewChange={ctx.handlers.onViewChange}
	title="Presupuestos"
	countNounOne="presupuesto registrado"
	countNounMany="presupuestos registrados"
	createLabel="Nuevo presupuesto"
	onCreate={ctx.handlers.onCreate}
/>

<QuoteKpiCards stats={ctx.stats} onSelect={ctx.handlers.onKpiSelect} />

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
		toggles={{ cashea: ctx.cashea, shippingPending: false, freeItem: false, balance: false }}
		toggleOptions={QUOTE_LIST_TOGGLES}
		activeToggleCount={ctx.cashea ? 1 : 0}
		onSearch={ctx.handlers.onSearch}
		onSellerChange={ctx.handlers.onSellerChange}
		onPresetChange={ctx.handlers.onPresetChange}
		onRangeChange={ctx.handlers.onRangeChange}
		onToggle={ctx.handlers.onToggleCashea}
		onSortChange={(next) => ctx.handlers.onSortChange(next as QuoteListSort)}
		searchPlaceholder="Buscar por cliente, vendedor o # de presupuesto…"
		sortOptions={QUOTE_LIST_SORT_OPTIONS}
		ariaLabel="Buscar presupuestos"
	/>

	<SaleStatusTabs
		statuses={LIST_QUOTE_STATUSES}
		labels={QUOTE_STATUS_LABELS}
		counts={ctx.facets}
		value={ctx.statuses}
		onchange={(next) => ctx.handlers.onStatusesChange(next as QuoteStatus[])}
		ariaLabel="Filtrar por estado"
		allLabel="Todos"
	/>

	<SaleFilterChips chips={ctx.chips} onClear={ctx.handlers.onClearFilters} />
</section>

<p class="sr-only" aria-live="polite">{ctx.quotesData.total} presupuestos</p>

<div
	class="overflow-hidden rounded-[var(--ds-radius-lg)] bg-white shadow-[var(--ds-shadow-sm)] {ctx.loading &&
	ctx.quotesData.quotes.length > 0
		? 'pointer-events-none opacity-60'
		: ''}"
	aria-busy={ctx.loading}
>
	{#if ctx.loading && ctx.quotesData.quotes.length === 0}
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
	{:else if ctx.quotesData.quotes.length === 0}
		<QuoteListEmpty
			hasFilters={ctx.chips.length > 0 || ctx.search.trim().length > 0}
			onClearFilters={ctx.handlers.onClearFilters}
		/>
	{:else}
		{#if ctx.view === 'list'}
			<QuotesListView
				quotes={ctx.quotesData.quotes}
				canManage={ctx.canAct}
				onOpen={ctx.handlers.onOpen}
				onEdit={ctx.handlers.onEdit}
				onDuplicate={ctx.handlers.onDuplicate}
				onConvert={ctx.handlers.onConvert}
				onCancel={ctx.handlers.onCancelRequest}
			/>
		{:else}
			<!-- Mismo contenedor blanco que ventas: la cuadrícula va dentro con padding. -->
			<div class="p-3">
				<QuotesGridView
					quotes={ctx.quotesData.quotes}
					canManage={ctx.canAct}
					onOpen={ctx.handlers.onOpen}
					onEdit={ctx.handlers.onEdit}
					onDuplicate={ctx.handlers.onDuplicate}
					onConvert={ctx.handlers.onConvert}
					onCancel={ctx.handlers.onCancelRequest}
				/>
			</div>
		{/if}

		<SaleListFooter
			page={ctx.quotesData.page}
			perPage={ctx.quotesData.perPage}
			total={ctx.quotesData.total}
			totalPages={ctx.quotesData.totalPages}
			selection={ctx.quotesData.selection}
			showPerPage={ctx.view === 'list'}
			onPageChange={(next) => ctx.handlers.onPageChange(next)}
			onPerPageChange={ctx.handlers.onPerPageChange}
			unitNounOne="presupuesto"
			unitNounMany="presupuestos"
			selectionTooltip="Suma de los {'{total}'} presupuestos que cumplen los filtros"
		/>
	{/if}
</div>
