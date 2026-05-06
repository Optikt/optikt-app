<script lang="ts">
	import { Eye, Glasses, Package, Sun, Trash2 } from '@lucide/svelte';
	import {
		ProductType,
		PurchaseOrderItemType,
		getLensTypeLabel,
		getPriceTypeLabel,
		getProductTypeLabel
	} from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import {
		calculateDraftItemSubtotal,
		calculateDraftItemTax,
		calculateDraftItemTotal,
		calculateUnitPurchasePriceFromLineTotal,
		getPreTaxUnitPrice,
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
		'w-full rounded-lg border-none bg-surface-container-high px-2.5 py-2 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
	const compactInputClass = `${inputClass} h-10 text-right font-mono text-sm tabular-nums`;

	const lineSubtotal = $derived(calculateDraftItemSubtotal(item));
	const lineTax = $derived(calculateDraftItemTax(item));
	const lineTotal = $derived(calculateDraftItemTotal(item));
	const preTaxUnitCost = $derived(getPreTaxUnitPrice(item));
	const visiblePreTaxUnitCost = $derived(round2(preTaxUnitCost));
	let editingLineTotal = $state(false);
	let lineTotalDraftValue = $state('');
	const lineTotalInputValue = $derived(
		editingLineTotal ? lineTotalDraftValue : formatDecimalInput(lineTotal)
	);

	function round2(n: number): number {
		return Math.round(n * 100) / 100;
	}

	function formatDecimalInput(value: number): string {
		return Number.isFinite(value) ? value.toFixed(2) : '0.00';
	}

	function getNumberInputValue(e: Event): number | null {
		const value = (e.currentTarget as HTMLInputElement).valueAsNumber;
		return Number.isFinite(value) ? value : null;
	}

	function toggleTaxable() {
		if (item.appliesIva) {
			item.unitPurchasePrice = round2(item.unitPurchasePrice / (1 + item.ivaRate / 100));
			item.appliesIva = false;
		} else {
			item.appliesIva = true;
			item.unitPurchasePrice = round2(item.unitPurchasePrice * (1 + item.ivaRate / 100));
		}
	}

	function handlePreTaxInput(e: Event) {
		const val = getNumberInputValue(e);
		if (val !== null && val >= 0) {
			item.unitPurchasePrice = round2(val * (1 + item.ivaRate / 100));
		}
	}

	function handleLineTotalFocus() {
		editingLineTotal = true;
		lineTotalDraftValue = formatDecimalInput(lineTotal);
	}

	function handleLineTotalInput(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const value = getNumberInputValue(e);

		lineTotalDraftValue = input.value;

		if (value !== null && value >= 0) {
			item.unitPurchasePrice = calculateUnitPurchasePriceFromLineTotal(value, item.quantity);
		}
	}

	function handleLineTotalBlur() {
		editingLineTotal = false;
		lineTotalDraftValue = '';
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

	function compactItemCode(): string {
		if (product) {
			return product.sku;
		}

		if (lensItem) {
			const lensTypeLabel = getLensTypeLabel(lensItem.type);
			const lensTypeCode = lensTypeLabel.slice(0, 4).toUpperCase();
			const materialCode = lensItem.material?.code?.toUpperCase();

			return materialCode ? `${materialCode}-${lensTypeCode}` : lensTypeCode;
		}

		return item.itemType === PurchaseOrderItemType.PRODUCT ? 'SKU' : 'LENTE';
	}

	function typeLabel(): string {
		if (product) {
			return getProductTypeLabel(product.type);
		}

		if (lensItem) {
			return `Lente ${getLensTypeLabel(lensItem.type)}`;
		}

		return item.itemType === PurchaseOrderItemType.PRODUCT ? 'Producto' : 'Lente';
	}

	function totalTooltip(): string {
		const parts = [`Subtotal (s/IVA): ${formatPrice(lineSubtotal)}`];

		if (lineTax > 0) {
			parts.push(`IVA ${item.ivaRate}%: ${formatPrice(lineTax)}`);
		}

		parts.push(`Total (costo real): ${formatPrice(lineTotal)}`);

		return parts.join(' · ');
	}
</script>

<div class="rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-4 shadow-sm">
	<div
		class="grid gap-3 xl:grid-cols-[52px_minmax(180px,0.92fr)_80px_276px_104px_104px_148px_32px] xl:items-center xl:gap-4"
	>
		<div class="space-y-2">
			<p
				class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase xl:hidden"
			>
				Tipo
			</p>
			<div class="flex h-10 items-center">
				<div
					class="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-surface-container-high text-brand-navy"
					title={typeLabel()}
					aria-label={typeLabel()}
				>
					{#if product?.type === ProductType.SUNGLASSES}
						<Sun class="h-4 w-4" />
					{:else if product?.type === ProductType.ACCESSORY}
						<Package class="h-4 w-4" />
					{:else if product?.type === ProductType.CONTACT_LENS}
						<Eye class="h-4 w-4" />
					{:else if item.itemType === PurchaseOrderItemType.LENS}
						<Eye class="h-4 w-4" />
					{:else}
						<Glasses class="h-4 w-4" />
					{/if}
				</div>
			</div>
		</div>

		<div class="space-y-2">
			<p
				class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase xl:hidden"
			>
				Artículo
			</p>
			<div
				class="flex h-10 items-center rounded-xl bg-surface-container-high px-4"
				title={`${itemTitle()}${selectionMeta() ? `\n${selectionMeta()}` : ''}`}
			>
				<p class="truncate font-mono text-sm font-semibold text-brand-navy">
					{compactItemCode()}
				</p>
			</div>
		</div>

		<div class="space-y-2">
			<p
				class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase xl:hidden"
			>
				Cant.
			</p>
			<input
				type="number"
				min="1"
				bind:value={item.quantity}
				class={compactInputClass}
				aria-label="Cantidad"
			/>
		</div>

		<div class="space-y-2">
			<p
				class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase xl:hidden"
			>
				Costo und.
			</p>
			{#if item.appliesIva}
				<div class="grid grid-cols-2 gap-2 xl:items-center">
					<div class="relative space-y-1 xl:space-y-0">
						<p
							class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase xl:pointer-events-none xl:absolute xl:top-1/2 xl:left-3 xl:z-10 xl:-translate-y-1/2"
						>
							s/IVA
						</p>
						<input
							type="number"
							min="0"
							step="any"
							value={visiblePreTaxUnitCost}
							onchange={handlePreTaxInput}
							class={`${compactInputClass} xl:px-3.5 xl:pl-[3.6rem]`}
							aria-label="Costo unitario sin IVA"
						/>
					</div>
					<div class="relative space-y-1 xl:space-y-0">
						<p
							class="text-[10px] font-semibold tracking-[0.14em] text-brand-blue uppercase xl:pointer-events-none xl:absolute xl:top-1/2 xl:left-3 xl:z-10 xl:-translate-y-1/2"
						>
							c/IVA
						</p>
						<input
							type="number"
							min="0"
							step="any"
							bind:value={item.unitPurchasePrice}
							class={`${compactInputClass} xl:px-3.5 xl:pl-[3.8rem]`}
							aria-label="Costo unitario con IVA"
						/>
					</div>
				</div>
			{:else}
				<input
					type="number"
					min="0"
					step="any"
					bind:value={item.unitPurchasePrice}
					class={compactInputClass}
					aria-label="Costo unitario"
				/>
			{/if}
		</div>

		<div class="space-y-2">
			<p
				class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase xl:hidden"
			>
				Venta und.
			</p>
			<input
				type="number"
				min="0"
				step="0.01"
				bind:value={item.unitSalePrice}
				class={compactInputClass}
				aria-label="Venta unitaria sugerida"
			/>
		</div>

		<div class="space-y-2">
			<p
				class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase xl:hidden"
			>
				Impuesto
			</p>
			<div class="flex h-10 items-center gap-1.5">
				<button
					type="button"
					onclick={toggleTaxable}
					class={`inline-flex h-10 min-w-[3.5rem] shrink-0 items-center justify-center rounded-lg px-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors ${
						item.appliesIva
							? 'bg-brand-blue/12 text-brand-blue hover:bg-brand-blue/18'
							: 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
					}`}
					title={item.appliesIva ? 'Gravable con IVA' : 'Exento de IVA'}
				>
					{item.appliesIva ? 'IVA' : 'EX'}
				</button>

				{#if item.appliesIva}
					<input
						type="number"
						min="0"
						max="100"
						step="0.01"
						bind:value={item.ivaRate}
						class="h-10 w-16 [appearance:textfield] rounded-lg border-none bg-surface-container-high px-2.5 py-2 text-right font-mono text-xs text-on-surface tabular-nums transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
						aria-label="Tasa de IVA"
						title="Tasa de IVA (%)"
					/>
				{/if}
			</div>
		</div>

		<div class="space-y-2 xl:text-right">
			<p
				class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase xl:hidden"
			>
				Total costo
			</p>
			<div class="relative">
				<span
					class="pointer-events-none absolute top-1/2 left-2.5 z-10 -translate-y-1/2 font-mono text-[10px] font-bold tracking-[0.12em] text-outline uppercase"
				>
					USD
				</span>
				<input
					type="number"
					min="0"
					step="0.01"
					value={lineTotalInputValue}
					onfocus={handleLineTotalFocus}
					oninput={handleLineTotalInput}
					onblur={handleLineTotalBlur}
					class={`${compactInputClass} !pl-11 font-semibold text-brand-navy`}
					aria-label="Total costo"
					title={totalTooltip()}
				/>
			</div>
		</div>

		<div class="flex h-10 items-center justify-end">
			{#if showRemove}
				<button
					type="button"
					onclick={onremove}
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-outline transition-colors hover:bg-error-container hover:text-on-error-container"
					aria-label="Eliminar línea"
					title="Eliminar línea"
				>
					<Trash2 class="h-3.5 w-3.5" />
				</button>
			{/if}
		</div>
	</div>
</div>
