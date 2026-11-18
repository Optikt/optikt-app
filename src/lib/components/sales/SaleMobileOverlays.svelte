<script lang="ts">
	import { getContext } from 'svelte';
	import SaleRowActionsSheet from './SaleRowActionsSheet.svelte';
	import SaleMobileFilterSheet from './SaleMobileFilterSheet.svelte';
	import { SALE_LIST_KEY, type SaleListContext } from './saleListContext';
	import { countSales } from '$lib/remote/sales/queries.remote';
	import { logger } from '$lib/utils';

	/**
	 * Hojas móviles del listado (filtros + acciones del ⋯).
	 * Debe montarse FUERA del contenedor `@container` de la página: `fixed` +
	 * `container-type` son incompatibles (mismo motivo que la barra móvil del
	 * detalle). Comparte estado con la plantilla vía `ctx.mobileUi`.
	 */
	const ctx: SaleListContext = getContext(SALE_LIST_KEY);

	// ── Conteo en vivo de «Ver N ventas» ─────────────────────────────────────
	let liveCount = $state<number | null>(null);

	let countTimer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		// Dependencias: todos los filtros que cambian el conteo.
		void ctx.statuses;
		void ctx.sellerId;
		void ctx.preset;
		void ctx.from;
		void ctx.to;
		void ctx.cashea;
		void ctx.shippingPending;
		void ctx.freeItem;
		void ctx.balance;
		void ctx.search;
		void ctx.sort;
		void ctx.mobileUi.filtersOpen;

		liveCount = null;
		clearTimeout(countTimer);
		countTimer = setTimeout(() => {
			void refreshLiveCount();
		}, 300);
		return () => clearTimeout(countTimer);
	});

	async function refreshLiveCount(): Promise<void> {
		try {
			liveCount = await countSales({
				statuses: ctx.statuses.length > 0 ? ctx.statuses : undefined,
				sellerId: ctx.sellerId || undefined,
				dateFrom: ctx.from ?? undefined,
				dateTo: ctx.to ?? undefined,
				search: ctx.search.trim() || undefined,
				shippingCostPending: ctx.shippingPending || undefined,
				hasFreeItem: ctx.freeItem || undefined,
				isCashea: ctx.cashea || undefined,
				balance: ctx.balance || undefined,
				sort: ctx.sort
			});
		} catch (e) {
			logger.error('Error contando ventas (hoja de filtros)', e);
			liveCount = null;
		}
	}
</script>

<SaleMobileFilterSheet
	bind:open={ctx.mobileUi.filtersOpen}
	{liveCount}
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
	onSellerChange={ctx.handlers.onSellerChange}
	onPresetChange={ctx.handlers.onPresetChange}
	onRangeChange={ctx.handlers.onRangeChange}
	onToggle={ctx.handlers.onToggle}
	onSortChange={ctx.handlers.onSortChange}
	onClear={ctx.handlers.onClearFilters}
/>

<SaleRowActionsSheet
	bind:open={ctx.mobileUi.actionsOpen}
	sale={ctx.mobileUi.actionsSale}
	canManage={ctx.canAct}
	currentUserId={ctx.user.id}
	currentUserRole={ctx.user.role}
	onCancel={ctx.handlers.onCancelRequest}
/>
