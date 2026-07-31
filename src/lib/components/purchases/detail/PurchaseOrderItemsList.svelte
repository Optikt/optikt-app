<script lang="ts">
	import {
		CircleCheck,
		PackageCheck,
		PackageOpen,
		RotateCcw,
		Search,
		SearchX
	} from '@lucide/svelte';
	import { AppBadge, EmptyState } from '$lib/components/ui';
	import { getPurchaseOrderReviewStatus } from '$lib/components/purchases/purchaseOrderDraft';
	import type {
		PurchaseOrderItemWithProduct,
		PurchaseOrderWithRelations
	} from '$lib/server/db/queries/purchaseOrders';
	import type { InventoryLot } from '$lib/server/db/schema';
	import { PurchaseOrderStatus } from '$lib/shared/enums';
	import { getSourceCurrencySymbol } from '$lib/shared/purchaseOrderCurrencies';
	import { formatCurrency, formatPrice } from '$lib/utils';
	import {
		ITEM_REVIEW_FILTER_OPTIONS,
		canRevertLot,
		formatAltAmount,
		formatLotCode,
		itemDisplayMeta,
		itemDisplayName,
		lotForItem,
		purchaseLineTotal,
		purchaseLineTotalAlt,
		type ItemReviewFilter
	} from '$lib/utils/purchaseOrderDetail';

	interface Props {
		purchaseOrder: PurchaseOrderWithRelations;
		items: PurchaseOrderItemWithProduct[];
		lotsMap: Record<string, InventoryLot>;
		showReviewColumn: boolean;
		onToggleItemReviewed: (item: PurchaseOrderItemWithProduct) => void;
		onRevertLot: (item: PurchaseOrderItemWithProduct) => void;
	}

	let {
		purchaseOrder,
		items,
		lotsMap,
		showReviewColumn,
		onToggleItemReviewed,
		onRevertLot
	}: Props = $props();

	const isConfirmed = $derived(purchaseOrder.status === PurchaseOrderStatus.CONFIRMED);
	const srcSymbol = $derived(getSourceCurrencySymbol(purchaseOrder.sourceCurrency));
	const showAltPrices = $derived(purchaseOrder.sourceCurrency !== 'USD');

	let itemSearch = $state('');
	let itemReviewFilter = $state<ItemReviewFilter>('all');

	const filteredItems = $derived.by(() => {
		const term = itemSearch.trim().toLowerCase();
		const matches = items.filter((item) => {
			if (itemReviewFilter === 'reviewed' && !item.isReviewed) return false;
			if (itemReviewFilter === 'pending' && item.isReviewed) return false;
			if (!term) return true;
			const haystack = [
				item.product?.name,
				item.product?.sku,
				item.product?.personalCode,
				item.lensCatalogItem?.name,
				item.lensCatalogItem?.type
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase();
			return haystack.includes(term);
		});
		return matches.slice().sort((a, b) => {
			const codeA = a.product?.personalCode?.trim() ?? '';
			const codeB = b.product?.personalCode?.trim() ?? '';
			if (codeA && !codeB) return -1;
			if (!codeA && codeB) return 1;
			if (codeA && codeB) {
				const diff = codeA.localeCompare(codeB, 'es', { numeric: true, sensitivity: 'base' });
				if (diff !== 0) return diff;
			}
			return itemDisplayName(a).localeCompare(itemDisplayName(b), 'es', { sensitivity: 'base' });
		});
	});

	const totalUnits = $derived(items.reduce((sum, item) => sum + item.quantity, 0));
	const reviewStatus = $derived(getPurchaseOrderReviewStatus(items));
	const zeroPriceCount = $derived(
		items.filter((item) => Number(item.unitPurchasePrice || 0) === 0).length
	);
	const totalItemCost = $derived(
		items.reduce(
			(sum, item) => sum + Number(item.unitPurchasePrice || 0) * Number(item.quantity || 0),
			0
		)
	);
	const totalItemCostAlt = $derived(
		items.reduce((sum, item) => sum + purchaseLineTotalAlt(item), 0)
	);
	const hasItemFilters = $derived(itemSearch.trim().length > 0 || itemReviewFilter !== 'all');
</script>

<div
	class="flex flex-col rounded-2xl bg-surface-container-low ring-1 ring-outline-variant/20 overflow-hidden"
>
	<div
		class="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/30 bg-surface-container-high shrink-0"
	>
		<PackageCheck class="h-5 w-5 text-brand-blue" />
		<h2 class="text-sm font-semibold uppercase tracking-wide text-brand-navy">
			Artículos recibidos
		</h2>
		{#if showReviewColumn}
			<AppBadge variant={filteredItems.every((i) => i.isReviewed) ? 'success' : 'warning'}>
				{items.filter((i) => i.isReviewed).length} / {items.length} revisadas
			</AppBadge>
		{/if}
		<AppBadge variant="neutral" class="ml-auto">{items.length} ítems</AppBadge>
	</div>

	{#if items.length > 0}
		<div
			class="flex flex-col gap-2 px-4 py-2.5 border-b border-outline-variant/20 bg-surface-container-lowest sm:flex-row sm:items-center"
		>
			<div class="relative flex-1">
				<Search class="absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-outline" />
				<input
					type="search"
					bind:value={itemSearch}
					placeholder="Buscar por nombre o SKU..."
					class="w-full rounded-lg border-none bg-surface-container-high py-2 pr-3 pl-10 text-sm text-on-surface placeholder:text-outline focus:bg-surface-container-highest focus:ring-0"
					aria-label="Buscar ítems en la orden"
				/>
			</div>
			{#if showReviewColumn}
				<div class="inline-flex rounded-lg bg-surface-container-high p-1 text-xs font-semibold">
					{#each ITEM_REVIEW_FILTER_OPTIONS as option (option.value)}
						<button
							type="button"
							onclick={() => (itemReviewFilter = option.value)}
							class={[
								'rounded-md px-3 py-1.5 transition-colors',
								itemReviewFilter === option.value
									? 'bg-surface-container-lowest text-brand-navy shadow-sm'
									: 'text-on-surface-variant hover:text-brand-navy'
							]}
							aria-pressed={itemReviewFilter === option.value}
						>
							{option.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	{#snippet reviewToggleButton(item: PurchaseOrderItemWithProduct)}
		<button
			type="button"
			onclick={() => onToggleItemReviewed(item)}
			aria-pressed={item.isReviewed}
			class="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors {item.isReviewed
				? 'bg-success text-white shadow-sm'
				: 'text-outline hover:bg-surface-container-high hover:text-on-surface'}"
			aria-label={item.isReviewed ? 'Marcar como no revisada' : 'Marcar como revisada'}
			title={item.isReviewed
				? 'Línea revisada — click para desmarcar'
				: 'Marcar línea como revisada'}
		>
			<CircleCheck class="h-4 w-4" />
		</button>
	{/snippet}

	{#snippet revertButton(item: PurchaseOrderItemWithProduct)}
		<button
			type="button"
			onclick={() => onRevertLot(item)}
			title="Deshacer recepción completa del lote"
			aria-label="Deshacer recepción completa del lote"
			class="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg text-error transition-colors hover:bg-error-container/60 hover:text-on-error-container"
		>
			<RotateCcw class="h-4 w-4" />
		</button>
	{/snippet}

	{#snippet pricePair(label: string, value: string, valueClass = 'text-on-surface')}
		<div class="flex items-baseline justify-between gap-2">
			<span class="text-on-surface-variant">{label}</span>
			<span class="font-mono tabular-nums {valueClass}">{value}</span>
		</div>
	{/snippet}

	{#snippet itemName(item: PurchaseOrderItemWithProduct, extraClass = '')}
		<p
			class="text-sm leading-snug font-semibold text-brand-navy break-words {extraClass}"
			title="{itemDisplayName(item)} • {itemDisplayMeta(item)}"
		>
			{itemDisplayName(item)}
		</p>
	{/snippet}

	{#snippet searchXEmptyIcon()}
		<SearchX class="h-12 w-12" />
	{/snippet}

	{#snippet packageOpenEmptyIcon()}
		<PackageOpen class="h-12 w-12" />
	{/snippet}

	{#if filteredItems.length > 0}
		<!-- ============ MOBILE: cards apiladas ============ -->
		<div class="md:hidden flex flex-col gap-2 p-3">
			{#each filteredItems as item (item.id)}
				{@const lot = lotForItem(item, lotsMap)}
				{@const showAlt = showAltPrices && item.unitPurchasePriceAlt !== null}
				{@const altTotal = purchaseLineTotalAlt(item)}
				{@const lineTotal = purchaseLineTotal(item)}
				<div
					class="rounded-xl bg-surface-container-lowest ring-1 ring-outline-variant/15 p-3 {showReviewColumn &&
					item.isReviewed
						? 'ring-success/40 bg-success-container/30'
						: ''}"
				>
					<div class="flex items-start gap-2">
						<span
							class="shrink-0 font-mono text-xs font-bold text-brand-navy bg-surface-container-high w-8 h-8 flex items-center justify-center rounded-lg"
							>{item.quantity}x</span
						>
						{@render itemName(item, 'flex-1 min-w-0')}
						{#if showReviewColumn}
							{@render reviewToggleButton(item)}
						{/if}
					</div>

					{#if item.product?.personalCode}
						<p class="mt-1 font-mono text-[11px] leading-4 text-on-surface-variant break-all">
							{item.product.personalCode}
						</p>
					{/if}

					<div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
						{@render pricePair(
							'C. Unit',
							formatCurrency(showAlt ? (item.unitPurchasePriceAlt ?? 0) : item.unitPurchasePrice)
						)}
						{@render pricePair(
							'Total',
							formatCurrency(showAlt ? altTotal : lineTotal),
							'font-semibold text-brand-navy'
						)}
						{@render pricePair('Venta', formatCurrency(item.unitSalePrice), 'text-brand-blue')}
						{@render pricePair(
							'IVA',
							item.appliesIva ? `${item.ivaRate}%` : 'Exento',
							item.appliesIva ? 'text-brand-blue' : 'text-outline'
						)}
					</div>

					{#if isConfirmed}
						<div
							class="mt-2 pt-2 border-t border-outline-variant/15 flex items-center justify-between gap-2 text-xs"
						>
							{#if lot}
								<div class="flex items-center gap-1.5 min-w-0">
									<span class="text-on-surface-variant shrink-0">Lote</span>
									<span class="font-mono text-sm font-semibold text-brand-navy truncate">
										{formatLotCode(item.lotId, lotsMap)}
									</span>
									<span class="text-on-surface-variant shrink-0">
										Disp. {lot.quantityAvailable}/{lot.quantityInitial}
									</span>
								</div>
								{#if canRevertLot(item, lotsMap)}
									{@render revertButton(item)}
								{/if}
							{:else}
								<span class="text-outline">Sin lote</span>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- ============ DESKTOP: tabla semántica ============ -->
		<div class="hidden md:block overflow-x-auto">
			<table class="w-full table-fixed text-sm">
				<colgroup>
					{#if showReviewColumn}
						<col style="width: 2.5rem" />
					{/if}
					<col style="width: 2.5rem" />
					<col style="width: 5rem" />
					<col />
					<col style="width: 4.5rem" />
					<col style="width: 5rem" />
					<col style="width: 4.5rem" />
					{#if isConfirmed}
						<col style="width: 6rem" />
					{/if}
				</colgroup>
				<thead
					class="bg-surface-container-high/70 text-[10px] font-medium uppercase tracking-wide text-on-surface-variant"
				>
					<tr>
						{#if showReviewColumn}
							<th class="px-2 py-2.5 text-center" aria-label="Revisada"></th>
						{/if}
						<th class="px-2 py-2.5 text-center" title="Cantidad">Cant.</th>
						<th class="px-2 py-2.5 text-left" title="Código">Código</th>
						<th class="px-2 py-2.5 text-left" title="Artículo">Artículo</th>
						<th class="px-2 py-2.5 text-right" title="Costo unitario">C. Unit {srcSymbol}</th>
						<th class="px-2 py-2.5 text-right" title="Total compra">Total {srcSymbol}</th>
						<th class="px-2 py-2.5 text-right" title="Venta sugerida">Venta $</th>
						{#if isConfirmed}
							<th class="px-2 py-2.5 text-right" title="Lote">Lote</th>
						{/if}
					</tr>
				</thead>
				<tbody class="divide-y divide-outline-variant/15">
					{#each filteredItems as item (item.id)}
						{@const lot = lotForItem(item, lotsMap)}
						{@const showAlt = showAltPrices && item.unitPurchasePriceAlt !== null}
						{@const altTotal = purchaseLineTotalAlt(item)}
						{@const lineTotal = purchaseLineTotal(item)}
						<tr
							class="align-top transition-colors {showReviewColumn && item.isReviewed
								? 'bg-success-container/30'
								: 'hover:bg-surface-container-high/50'}"
						>
							{#if showReviewColumn}
								<td class="px-2 py-2.5 text-center">
									{@render reviewToggleButton(item)}
								</td>
							{/if}
							<td class="px-2 py-2.5 text-center font-mono text-sm text-brand-navy tabular-nums">
								{item.quantity}
							</td>
							<td class="px-2 py-2.5">
								{#if item.product?.personalCode}
									<span
										class="font-mono text-xs leading-4 font-semibold text-brand-navy break-all"
										title={item.product.personalCode}
									>
										{item.product.personalCode}
									</span>
								{:else}
									<span class="text-xs text-outline">--</span>
								{/if}
							</td>
							<td class="px-2 py-2.5">
								{@render itemName(item)}
								<span
									class="mt-1 inline-block w-fit px-1 py-0.5 rounded text-[9px] font-bold {item.appliesIva
										? 'bg-brand-blue/10 text-brand-blue'
										: 'bg-surface-container-high text-on-surface-variant'}"
									>{item.appliesIva ? `IVA ${item.ivaRate}%` : 'Exento'}</span
								>
							</td>
							<td class="px-2 py-2.5 text-right">
								{#if showAlt}
									<span class="font-mono text-xs text-on-surface-variant tabular-nums">
										{formatCurrency(item.unitPurchasePriceAlt ?? 0)}
									</span>
									<p
										class="mt-0.5 text-[10px] font-semibold tracking-[0.12em] text-outline uppercase"
									>
										{formatPrice(item.unitPurchasePrice)}
									</p>
								{:else}
									<span class="font-mono text-xs text-on-surface-variant tabular-nums">
										{formatCurrency(item.unitPurchasePrice)}
									</span>
								{/if}
							</td>
							<td class="px-2 py-2.5 text-right">
								{#if showAlt}
									<span class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
										{formatCurrency(altTotal)}
									</span>
									<p
										class="mt-0.5 text-[10px] font-semibold tracking-[0.12em] text-outline uppercase"
									>
										{formatPrice(lineTotal)}
									</p>
								{:else}
									<span class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
										{formatCurrency(lineTotal)}
									</span>
								{/if}
							</td>
							<td class="px-2 py-2.5 text-right">
								<span class="font-mono text-xs text-brand-blue tabular-nums">
									{formatCurrency(item.unitSalePrice)}
								</span>
							</td>
							{#if isConfirmed}
								<td class="px-2 py-2.5 text-right">
									{#if lot}
										<div class="flex items-start justify-end gap-2">
											<p class="font-mono text-sm font-semibold text-brand-navy">
												{formatLotCode(item.lotId, lotsMap)}
											</p>
											{#if canRevertLot(item, lotsMap)}
												{@render revertButton(item)}
											{/if}
										</div>
										<p class="mt-1 text-xs text-on-surface-variant">
											Disponible {lot.quantityAvailable}/{lot.quantityInitial}
										</p>
									{:else}
										<span class="text-sm text-outline">Sin lote</span>
									{/if}
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="px-4 py-8 text-center">
			{#if hasItemFilters}
				<EmptyState
					message="Ningún ítem coincide con el filtro."
					icon={searchXEmptyIcon}
					ariaLabel="Sin resultados de búsqueda"
				/>
				<button
					type="button"
					onclick={() => {
						itemSearch = '';
						itemReviewFilter = 'all';
					}}
					class="mt-1 text-sm font-semibold text-brand-blue hover:underline"
				>
					Limpiar filtros
				</button>
			{:else}
				<EmptyState
					message="No hay ítems en esta orden."
					icon={packageOpenEmptyIcon}
					ariaLabel="Orden sin ítems"
				/>
				<p class="mt-1 text-sm text-outline">
					La cabecera está creada, pero aún no tiene líneas registradas.
				</p>
			{/if}
		</div>
	{/if}

	<div
		class="border-t border-outline-variant/20 px-4 py-2 bg-surface-container-high/50 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0"
	>
		<div class="flex items-center gap-2 flex-wrap">
			<AppBadge variant="neutral">{totalUnits} unidades</AppBadge>
			{#if showReviewColumn}
				<AppBadge variant={reviewStatus.allReviewed ? 'success' : 'info'}>
					{reviewStatus.reviewedCount}/{items.length} revisados
				</AppBadge>
			{/if}
			{#if zeroPriceCount > 0}
				<AppBadge variant="warning">{zeroPriceCount} con advertencia</AppBadge>
			{/if}
		</div>
		<span class="font-mono text-sm font-semibold text-brand-navy tabular-nums"
			>Total: {formatAltAmount(
				showAltPrices ? totalItemCostAlt : totalItemCost,
				purchaseOrder.sourceCurrency
			)}</span
		>
	</div>
</div>
