<script lang="ts">
	import { CircleCheck, Eye, Glasses, Package, Sun, Trash2 } from '@lucide/svelte';
	import {
		ProductType,
		PurchaseOrderItemType,
		PurchaseSourceCurrency,
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
		calculateUnitPurchasePriceAltFromLineTotal,
		calculateDraftItemSubtotalAlt,
		calculateDraftItemTaxAlt,
		calculateDraftItemTotalAlt,
		getPreTaxUnitPrice,
		isDraftItemUserEditingLocked,
		type PurchaseOrderDraftItem
	} from './purchaseOrderDraft';
	import {
		getSourceCurrencySymbol,
		sourcePriceToUsdBcv
	} from '$lib/shared/purchaseOrderCurrencies';

	interface Props {
		item: PurchaseOrderDraftItem;
		product?: ProductWithRelations | null;
		lensItem?: LensCatalogItemWithRelations | null;
		sourceCurrency: string;
		bcvUsdRate: number;
		sourceRateToVes?: number;
		showRemove?: boolean;
		onremove?: () => void;
	}

	let {
		item = $bindable(),
		product = null,
		lensItem = null,
		sourceCurrency,
		bcvUsdRate,
		sourceRateToVes = 0,
		showRemove = false,
		onremove
	}: Props = $props();

	const isAltMode = $derived(sourceCurrency !== PurchaseSourceCurrency.USD);
	const altSymbol = $derived(getSourceCurrencySymbol(sourceCurrency));
	const preTaxUnitCost = $derived(getPreTaxUnitPrice(item));

	function hasZeroValueFieldsForItem(
		currentItem: Pick<PurchaseOrderDraftItem, 'unitPurchasePrice' | 'unitSalePrice'>
	): boolean {
		return (
			Number(currentItem.unitPurchasePrice || 0) === 0 ||
			Number(currentItem.unitSalePrice || 0) === 0
		);
	}

	let materialBaseline = {
		productId: item.productId,
		lensCatalogItemId: item.lensCatalogItemId,
		quantity: item.quantity,
		unitPurchasePrice: item.unitPurchasePrice,
		unitPurchasePriceAlt: item.unitPurchasePriceAlt,
		unitSalePrice: item.unitSalePrice,
		appliesIva: item.appliesIva,
		ivaRate: item.ivaRate,
		itemType: item.itemType
	};
	$effect(() => {
		const changed =
			materialBaseline.productId !== item.productId ||
			materialBaseline.lensCatalogItemId !== item.lensCatalogItemId ||
			materialBaseline.quantity !== item.quantity ||
			materialBaseline.unitPurchasePrice !== item.unitPurchasePrice ||
			materialBaseline.unitPurchasePriceAlt !== item.unitPurchasePriceAlt ||
			materialBaseline.unitSalePrice !== item.unitSalePrice ||
			materialBaseline.appliesIva !== item.appliesIva ||
			materialBaseline.ivaRate !== item.ivaRate ||
			materialBaseline.itemType !== item.itemType;
		const zeroPriceContextChanged =
			materialBaseline.productId !== item.productId ||
			materialBaseline.lensCatalogItemId !== item.lensCatalogItemId ||
			materialBaseline.unitPurchasePrice !== item.unitPurchasePrice ||
			materialBaseline.unitPurchasePriceAlt !== item.unitPurchasePriceAlt ||
			materialBaseline.unitSalePrice !== item.unitSalePrice ||
			materialBaseline.itemType !== item.itemType;
		if (changed) {
			if (item.isReviewed) item.isReviewed = false;
			if (zeroPriceContextChanged && item.isZeroPriceIntentional) {
				item.isZeroPriceIntentional = false;
			}
			materialBaseline = {
				productId: item.productId,
				lensCatalogItemId: item.lensCatalogItemId,
				quantity: item.quantity,
				unitPurchasePrice: item.unitPurchasePrice,
				unitPurchasePriceAlt: item.unitPurchasePriceAlt,
				unitSalePrice: item.unitSalePrice,
				appliesIva: item.appliesIva,
				ivaRate: item.ivaRate,
				itemType: item.itemType
			};
			return;
		}

		if (!hasZeroValueFieldsForItem(item) && item.isZeroPriceIntentional) {
			item.isZeroPriceIntentional = false;
		}
	});

	const inputClass =
		'w-full rounded-lg border-none bg-surface-container-high px-2 py-1.5 text-xs text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 disabled:cursor-not-allowed disabled:opacity-65 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
	const compactInputClass = `${inputClass} h-8 text-right font-mono text-xs tabular-nums`;

	const lineSubtotal = $derived(calculateDraftItemSubtotal(item));
	const lineTax = $derived(calculateDraftItemTax(item));
	const lineTotal = $derived(calculateDraftItemTotal(item));
	const lineSubtotalAlt = $derived(calculateDraftItemSubtotalAlt(item));
	const lineTaxAlt = $derived(calculateDraftItemTaxAlt(item));
	const lineTotalAlt = $derived(calculateDraftItemTotalAlt(item));
	const hasZeroValueFields = $derived(hasZeroValueFieldsForItem(item));
	const userEditingLocked = $derived(isDraftItemUserEditingLocked(item));
	let editingLineTotal = $state(false);
	let lineTotalDraftValue = $state('');
	const displayedLineTotal = $derived(isAltMode ? lineTotalAlt : lineTotal);
	const lineTotalInputValue = $derived(
		!userEditingLocked && editingLineTotal
			? lineTotalDraftValue
			: formatDecimalInput(displayedLineTotal)
	);
	const margen = $derived(
		item.unitSalePrice > 0 && item.unitPurchasePrice > 0
			? ((item.unitSalePrice - item.unitPurchasePrice) / item.unitSalePrice) * 100
			: null
	);

	function round2(n: number): number {
		return Math.round(n * 100) / 100;
	}

	function formatDecimalInput(value: number): string {
		return Number.isFinite(value) ? value.toFixed(2) : '0.00';
	}

	function formatAlt(amount: number): string {
		const formatted = new Intl.NumberFormat('es-VE', {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2
		}).format(amount);
		return `${altSymbol} ${formatted}`;
	}

	function syncUsdPriceFromAlt() {
		item.unitPurchasePrice = sourcePriceToUsdBcv({
			sourceCurrency,
			unitPriceAlt: Number(item.unitPurchasePriceAlt ?? 0),
			appliesIva: item.appliesIva,
			ivaRate: item.ivaRate,
			sourceRateToVes,
			bcvRate: bcvUsdRate
		});
	}

	function getNumberInputValue(e: Event): number | null {
		const value = (e.currentTarget as HTMLInputElement).valueAsNumber;
		return Number.isFinite(value) ? value : null;
	}

	function toggleTaxable() {
		if (userEditingLocked) return;

		if (isAltMode) {
			item.appliesIva = !item.appliesIva;
			syncUsdPriceFromAlt();
			return;
		}

		if (item.appliesIva) {
			item.unitPurchasePrice = round2(item.unitPurchasePrice / (1 + item.ivaRate / 100));
			item.appliesIva = false;
		} else {
			item.appliesIva = true;
			item.unitPurchasePrice = round2(item.unitPurchasePrice * (1 + item.ivaRate / 100));
		}
	}

	function handleAltCostInput(e: Event) {
		if (userEditingLocked) return;
		const val = getNumberInputValue(e);
		if (val !== null && val >= 0) {
			item.unitPurchasePriceAlt = round2(val);
			syncUsdPriceFromAlt();
		}
	}

	function handleLineTotalFocus() {
		if (userEditingLocked) return;

		editingLineTotal = true;
		lineTotalDraftValue = formatDecimalInput(displayedLineTotal);
	}

	function handleLineTotalInput(e: Event) {
		if (userEditingLocked) return;

		const input = e.currentTarget as HTMLInputElement;
		const value = getNumberInputValue(e);

		lineTotalDraftValue = input.value;

		if (value !== null && value >= 0) {
			if (isAltMode) {
				item.unitPurchasePriceAlt = calculateUnitPurchasePriceAltFromLineTotal(
					value,
					item.quantity,
					item.appliesIva,
					item.ivaRate
				);
				syncUsdPriceFromAlt();
			} else {
				item.unitPurchasePrice = calculateUnitPurchasePriceFromLineTotal(value, item.quantity);
			}
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
		if (isAltMode) {
			const sym = altSymbol;
			const parts = [`Subtotal ${sym} (s/IVA): ${formatAlt(lineSubtotalAlt)}`];

			if (lineTaxAlt > 0) {
				parts.push(`IVA ${item.ivaRate}%: ${formatAlt(lineTaxAlt)}`);
			}

			parts.push(`Total ${sym}: ${formatAlt(lineTotalAlt)}`);
			if (bcvUsdRate > 0) {
				parts.push(`USD c/IVA und.: ${formatPrice(item.unitPurchasePrice)}`);
			}

			return parts.join(' · ');
		}

		const parts = [`Subtotal (s/IVA): ${formatPrice(lineSubtotal)}`];

		if (lineTax > 0) {
			parts.push(`IVA ${item.ivaRate}%: ${formatPrice(lineTax)}`);
		}

		parts.push(`Total (costo real): ${formatPrice(lineTotal)}`);

		return parts.join(' · ');
	}
	function toggleReviewed() {
		const nextReviewed = !item.isReviewed;

		if (nextReviewed) {
			editingLineTotal = false;
			lineTotalDraftValue = '';
		}

		item.isReviewed = nextReviewed;
	}

	function toggleZeroPriceIntentional() {
		if (!hasZeroValueFields) return;

		item.isZeroPriceIntentional = !item.isZeroPriceIntentional;
	}
</script>

<div
	class={[
		'rounded-xl border bg-surface-container-lowest p-2 shadow-sm transition-colors',
		item.isReviewed
			? 'border-success/40 bg-success-container/25 ring-1 ring-success/20'
			: 'border-outline-variant/20'
	]}
>
	<div
		class="grid items-center gap-2"
		style="grid-template-columns: minmax(120px,1fr) 60px 100px 75px 95px 80px;"
	>
		<!-- Artículo + IVA badge -->
		<div class="flex items-center gap-2 min-w-0">
			<div
				class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-container text-brand-navy"
				title={typeLabel()}
			>
				{#if product?.type === ProductType.SUNGLASSES}
					<Sun class="h-3.5 w-3.5" />
				{:else if product?.type === ProductType.ACCESSORY}
					<Package class="h-3.5 w-3.5" />
				{:else if product?.type === ProductType.CONTACT_LENS}
					<Eye class="h-3.5 w-3.5" />
				{:else if item.itemType === PurchaseOrderItemType.LENS}
					<Eye class="h-3.5 w-3.5" />
				{:else}
					<Glasses class="h-3.5 w-3.5" />
				{/if}
			</div>
			<div class="min-w-0 flex-1">
				<div class="flex items-center gap-1.5">
					<p class="truncate font-mono text-xs font-semibold text-brand-navy" title={itemTitle()}>
						{compactItemCode()}
					</p>
					<button
						type="button"
						onclick={toggleTaxable}
						disabled={userEditingLocked}
						class={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-65 ${
							item.appliesIva
								? 'bg-brand-blue/12 text-brand-blue hover:bg-brand-blue/18'
								: 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest'
						}`}
						title={item.appliesIva
							? 'Gravable — click para exentar'
							: 'Exento — click para hacer gravable'}
					>
						{item.appliesIva ? `IVA ${item.ivaRate}%` : 'EXENTO'}
					</button>
				</div>
				<p class="truncate text-[10px] text-on-surface-variant" title={selectionMeta()}>
					{selectionMeta()}
				</p>
			</div>
		</div>

		<!-- Cant. -->
		<div class="flex flex-col gap-0.5">
			<input
				type="number"
				min="1"
				bind:value={item.quantity}
				disabled={userEditingLocked}
				class={compactInputClass}
				aria-label="Cantidad"
			/>
			<span class="block h-[9px] leading-none"></span>
		</div>

		<!-- Costo und. -->
		{#if isAltMode}
			<div class="flex flex-col gap-0.5">
				<input
					type="number"
					min="0"
					step="any"
					value={Number(item.unitPurchasePriceAlt ?? 0)}
					onchange={handleAltCostInput}
					disabled={userEditingLocked}
					class={compactInputClass}
					aria-label={`Costo unitario en ${altSymbol}`}
				/>
				{#if item.appliesIva}
					<p class="text-right text-[9px] font-mono leading-none text-outline">
						c/IVA: {formatAlt(
							round2(Number(item.unitPurchasePriceAlt ?? 0) * (1 + item.ivaRate / 100))
						)}
					</p>
				{:else}
					<span class="block h-[9px] leading-none"></span>
				{/if}
			</div>
		{:else}
			<div class="flex flex-col gap-0.5">
				<input
					type="number"
					min="0"
					step="any"
					bind:value={item.unitPurchasePrice}
					disabled={userEditingLocked}
					class={compactInputClass}
					aria-label="Costo unitario"
				/>
				{#if item.appliesIva}
					<p class="text-right text-[9px] font-mono leading-none text-outline">
						Base: {formatPrice(preTaxUnitCost)}
					</p>
				{:else}
					<span class="block h-[9px] leading-none"></span>
				{/if}
			</div>
		{/if}

		<!-- Venta und. -->
		<div class="flex flex-col gap-0.5">
			<input
				type="number"
				min="0"
				step="0.01"
				bind:value={item.unitSalePrice}
				disabled={userEditingLocked}
				class={compactInputClass}
				aria-label="Venta unitaria sugerida"
			/>
			{#if margen !== null}
				<p
					class="text-right text-[9px] font-mono font-medium leading-none {margen >= 0
						? 'text-success'
						: 'text-error'}"
				>
					Marg: {margen.toFixed(0)}%
				</p>
			{:else}
				<span class="block h-[9px] leading-none"></span>
			{/if}
		</div>

		<!-- Total -->
		<div class="flex flex-col gap-0.5">
			<div class="relative">
				<span
					class="pointer-events-none absolute top-1/2 left-2 z-10 -translate-y-1/2 font-mono text-[10px] font-bold tracking-[0.12em] text-outline uppercase"
				>
					{isAltMode ? altSymbol.toUpperCase() : 'USD'}
				</span>
				<input
					type="number"
					min="0"
					step="0.01"
					value={lineTotalInputValue}
					onfocus={handleLineTotalFocus}
					oninput={handleLineTotalInput}
					onblur={handleLineTotalBlur}
					disabled={userEditingLocked}
					class={`${compactInputClass} !pl-7 font-semibold text-brand-navy`}
					aria-label={isAltMode ? `Total costo en ${altSymbol}` : 'Total costo'}
					title={totalTooltip()}
				/>
			</div>
			<span class="block h-[9px] leading-none"></span>
		</div>

		<!-- Checks -->
		<div class="flex flex-col gap-0.5">
			<div class="flex h-8 items-center justify-end gap-0.5">
				{#if hasZeroValueFields}
					<button
						type="button"
						onclick={toggleZeroPriceIntentional}
						aria-pressed={item.isZeroPriceIntentional}
						class={[
							'inline-flex h-6 shrink-0 items-center justify-center rounded-md px-1 text-[9px] font-bold tracking-[0.08em] uppercase transition-colors',
							item.isZeroPriceIntentional
								? 'bg-brand-blue/12 text-brand-blue hover:bg-brand-blue/18'
								: 'bg-warning-container/50 text-on-warning-container hover:bg-warning-container'
						]}
						aria-label={item.isZeroPriceIntentional
							? 'Precio en cero marcado como intencional'
							: 'Marcar precio en cero como intencional'}
						title={item.isZeroPriceIntentional
							? 'Precio en 0 intencional'
							: 'Marcar precio en cero como intencional'}
					>
						0!
					</button>
				{/if}
				<button
					type="button"
					onclick={toggleReviewed}
					aria-pressed={item.isReviewed}
					class={[
						'inline-flex h-6 w-6 items-center justify-center rounded-lg transition-colors',
						item.isReviewed
							? 'bg-success-container text-on-success-container hover:bg-success/30'
							: 'text-outline hover:bg-surface-container-high hover:text-on-surface'
					]}
					aria-label={item.isReviewed ? 'Marcar como no revisada' : 'Marcar como revisada'}
					title={item.isReviewed ? 'Línea revisada' : 'Marcar línea como revisada'}
				>
					<CircleCheck class="h-3.5 w-3.5" />
				</button>
				{#if showRemove}
					<button
						type="button"
						onclick={onremove}
						class="inline-flex h-6 w-6 items-center justify-center rounded-lg text-outline transition-colors hover:bg-error-container hover:text-on-error-container"
						aria-label="Eliminar línea"
						title="Eliminar línea"
					>
						<Trash2 class="h-3.5 w-3.5" />
					</button>
				{/if}
			</div>
			<span class="block h-[9px] leading-none"></span>
		</div>
	</div>
</div>
