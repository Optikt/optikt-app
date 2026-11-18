<script lang="ts">
	import { getContext } from 'svelte';
	import SaleRowActionsSheet from './SaleRowActionsSheet.svelte';
	import SaleMobileFilterSheet from './SaleMobileFilterSheet.svelte';
	import { SALE_LIST_KEY, type SaleListContext } from './saleListContext';

	/**
	 * Hojas móviles del listado (filtros + acciones del ⋯).
	 * Debe montarse FUERA del contenedor `@container` de la página: `fixed` +
	 * `container-type` son incompatibles (mismo motivo que la barra móvil del
	 * detalle). El estado vive en la página (`ctx.mobileUi`); las hojas solo
	 * notifican apertura/cierre vía los handlers del contexto.
	 */
	const ctx: SaleListContext = getContext(SALE_LIST_KEY);
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
	toggles={{
		cashea: ctx.cashea,
		shippingPending: ctx.shippingPending,
		freeItem: ctx.freeItem,
		balance: ctx.balance
	}}
	activeCount={ctx.chips.length}
	loading={ctx.loading}
	resultCount={ctx.salesData.total}
	onSellerChange={ctx.handlers.onSellerChange}
	onPresetChange={ctx.handlers.onPresetChange}
	onRangeChange={ctx.handlers.onRangeChange}
	onToggle={ctx.handlers.onToggle}
	onSortChange={ctx.handlers.onSortChange}
	onClear={ctx.handlers.onClearFilters}
/>

<SaleRowActionsSheet
	open={ctx.mobileUi.actionsOpen}
	sale={ctx.mobileUi.actionsSale}
	canManage={ctx.canAct}
	currentUserId={ctx.user.id}
	currentUserRole={ctx.user.role}
	onCancel={ctx.handlers.onCancelRequest}
	onclose={ctx.handlers.closeMobileActions}
/>
