<script lang="ts">
	import { getContext } from 'svelte';
	import SaleMobileFilterSheet from '$lib/components/sales/SaleMobileFilterSheet.svelte';
	import QuoteRowActionsSheet from './QuoteRowActionsSheet.svelte';
	import {
		QUOTE_LIST_KEY,
		QUOTE_LIST_SORT_OPTIONS,
		QUOTE_LIST_TOGGLES,
		type QuoteListContext
	} from './quoteListContext';
	import type { QuoteListSort } from './quoteListParams';

	/**
	 * Hojas móviles (filtros + acciones del ⋯). FUERA del contenedor
	 * `@container` de la página (fixed + containment son incompatibles).
	 * Reusa la hoja de filtros de ventas con las opciones de presupuestos.
	 */
	const ctx: QuoteListContext = getContext(QUOTE_LIST_KEY);
</script>

<SaleMobileFilterSheet
	open={ctx.mobileUi.filtersOpen}
	onclose={ctx.handlers.closeMobileFilters}
	sellers={ctx.sellers}
	sellerId={ctx.sellerId}
	preset={ctx.preset}
	from={ctx.from}
	to={ctx.to}
	sort={ctx.sort}
	toggles={{ cashea: ctx.cashea, shippingPending: false, freeItem: false, balance: false }}
	toggleOptions={QUOTE_LIST_TOGGLES}
	sortOptions={QUOTE_LIST_SORT_OPTIONS}
	resultNounOne="presupuesto"
	resultNounMany="presupuestos"
	idPrefix="quotes"
	activeCount={ctx.chips.length}
	loading={ctx.loading}
	resultCount={ctx.quotesData.total}
	onSellerChange={ctx.handlers.onSellerChange}
	onPresetChange={ctx.handlers.onPresetChange}
	onRangeChange={ctx.handlers.onRangeChange}
	onToggle={ctx.handlers.onToggleCashea}
	onSortChange={(next) => ctx.handlers.onSortChange(next as QuoteListSort)}
	onClear={ctx.handlers.onClearFilters}
/>

<QuoteRowActionsSheet
	open={ctx.mobileUi.actionsOpen}
	quote={ctx.mobileUi.actionsQuote}
	canManage={ctx.canAct}
	onOpen={ctx.handlers.onOpen}
	onEdit={ctx.handlers.onEdit}
	onDuplicate={ctx.handlers.onDuplicate}
	onConvert={ctx.handlers.onConvert}
	onCancel={ctx.handlers.onCancelRequest}
	onclose={ctx.handlers.closeMobileActions}
/>
