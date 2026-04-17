<script lang="ts">
	import { Trash2 } from '@lucide/svelte';
	import { AppBadge } from '$lib/components/ui';
	import { PurchaseOrderItemType, getLensTypeLabel, getPriceTypeLabel } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import {
		calculateDraftItemSubtotal,
		calculateDraftItemTax,
		calculateDraftItemTotal,
		type PurchaseOrderDraftItem
	} from './purchaseOrderDraft';

	interface Props {
		item: PurchaseOrderDraftItem;
		product?: ProductWithRelations | null;
		lensItem?: LensCatalogItemWithRelations | null;
		showRemove?: boolean;
		onremove?: () => void;
	}

	let {
		item = $bindable(),
		product = null,
		lensItem = null,
		showRemove = false,
		onremove
	}: Props = $props();

	const inputClass =
		'w-full rounded-lg border-none bg-surface-container-high px-3 py-3 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0';

	const lineSubtotal = $derived(calculateDraftItemSubtotal(item));
	const lineTax = $derived(calculateDraftItemTax(item));
	const lineTotal = $derived(calculateDraftItemTotal(item));

	function toggleTaxable() {
		item.appliesIva = !item.appliesIva;
	}

	function itemTitle(): string {
		if (product) {
			return `${product.sku} - ${product.name}`;
		}

		if (lensItem) {
			return lensItem.name;
		}

		return item.itemType === PurchaseOrderItemType.PRODUCT
			? 'Producto no disponible'
			: 'Lente no disponible';
	}

	function selectionMeta(): string {
		if (product) {
			const pieces = [product.brand?.name, product.supplier?.name].filter(Boolean);
			return pieces.length > 0 ? `${product.sku} · ${pieces.join(' · ')}` : product.sku;
		}

		if (lensItem) {
			const pieces = [
				getLensTypeLabel(lensItem.type),
				getPriceTypeLabel(lensItem.priceType),
				lensItem.supplier?.name
			].filter(Boolean);
			return pieces.join(' · ');
		}

		return item.itemType === PurchaseOrderItemType.PRODUCT
			? 'Selecciona un producto para autocompletar precios e IVA.'
			: 'Selecciona un lente para autocompletar costo, venta sugerida e IVA.';
	}
</script>

<div class="rounded-2xl bg-surface-container-lowest p-4 shadow-sm ring-1 ring-outline-variant/20">
	<div
		class="grid gap-4 xl:grid-cols-[120px_minmax(320px,1.8fr)_90px_140px_140px_120px_120px_44px] xl:items-start"
	>
		<div class="space-y-2">
			<p
				class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase xl:hidden"
			>
				Tipo
			</p>
			<div class="flex min-h-[3.25rem] items-center">
				<AppBadge variant={item.itemType === PurchaseOrderItemType.PRODUCT ? 'neutral' : 'info'}>
					{item.itemType === PurchaseOrderItemType.PRODUCT ? 'Producto' : 'Lente'}
				</AppBadge>
			</div>
		</div>

		<div class="space-y-2">
			<p
				class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase xl:hidden"
			>
				Artículo
			</p>
			<div class="rounded-xl bg-surface-container-high px-4 py-3">
				<p class="truncate text-sm font-semibold text-brand-navy" title={itemTitle()}>
					{itemTitle()}
				</p>
				<p class="mt-1 text-xs leading-5 text-on-surface-variant">
					{selectionMeta()}
				</p>
			</div>
		</div>

		<div class="space-y-2">
			<p
				class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase xl:hidden"
			>
				Cant.
			</p>
			<input
				type="number"
				min="1"
				bind:value={item.quantity}
				class={inputClass}
				aria-label="Cantidad"
			/>
		</div>

		<div class="space-y-2">
			<p
				class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase xl:hidden"
			>
				Costo unit.
			</p>
			<input
				type="number"
				min="0"
				step="0.01"
				bind:value={item.unitPurchasePrice}
				class={`${inputClass} text-right font-mono tabular-nums`}
				aria-label="Costo unitario"
			/>
		</div>

		<div class="space-y-2">
			<p
				class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase xl:hidden"
			>
				Venta sugerida
			</p>
			<input
				type="number"
				min="0"
				step="0.01"
				bind:value={item.unitSalePrice}
				class={`${inputClass} text-right font-mono tabular-nums`}
				aria-label="Venta sugerida"
			/>
		</div>

		<div class="space-y-2">
			<p
				class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase xl:hidden"
			>
				Impuesto
			</p>
			<button
				type="button"
				onclick={toggleTaxable}
				class={`inline-flex w-full items-center justify-center rounded-lg px-3 py-3 text-xs font-semibold tracking-[0.14em] uppercase transition-colors ${
					item.appliesIva
						? 'bg-brand-blue/12 text-brand-blue hover:bg-brand-blue/18'
						: 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
				}`}
			>
				{item.appliesIva ? `IVA ${item.ivaRate}%` : 'Exento'}
			</button>

			{#if item.appliesIva}
				<div class="flex items-center gap-2">
					<input
						type="number"
						min="0"
						max="100"
						step="0.01"
						bind:value={item.ivaRate}
						class={`${inputClass} px-3 py-2 text-right font-mono text-xs tabular-nums`}
						aria-label="Tasa de IVA"
					/>
					<span class="text-xs font-semibold text-on-surface-variant">%</span>
				</div>
			{/if}
		</div>

		<div class="space-y-2 xl:text-right">
			<p
				class="text-[11px] font-semibold tracking-[0.18em] text-on-surface-variant uppercase xl:hidden"
			>
				Total fila
			</p>
			<p class="font-mono text-base font-semibold text-brand-navy tabular-nums">
				{formatPrice(lineTotal)}
			</p>
			<p class="text-xs text-on-surface-variant">
				{lineTax > 0
					? `${formatPrice(lineSubtotal)} + IVA ${formatPrice(lineTax)}`
					: formatPrice(lineSubtotal)}
			</p>
		</div>

		<div class="flex items-start justify-end xl:pt-9">
			{#if showRemove}
				<button
					type="button"
					onclick={onremove}
					class="inline-flex h-10 w-10 items-center justify-center rounded-xl text-outline transition-colors hover:bg-error-container hover:text-on-error-container"
					aria-label="Eliminar línea"
					title="Eliminar línea"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			{/if}
		</div>
	</div>
</div>
