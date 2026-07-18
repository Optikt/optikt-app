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
		/** Source currency for item prices ('USD' | 'VES' | 'EUR') */
		sourceCurrency: string;
		bcvUsdRate: number;
		/** Source-to-VES rate (Bs per source-currency unit) */
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
	const altInputLabel = $derived(`${altSymbol} s/IVA`);
	const altAriaLabel = $derived(`Costo unitario sin IVA en ${altSymbol}`);

	function hasZeroValueFieldsForItem(
		currentItem: Pick<PurchaseOrderDraftItem, 'unitPurchasePrice' | 'unitSalePrice'>
	): boolean {
		return (
			Number(currentItem.unitPurchasePrice || 0) === 0 ||
			Number(currentItem.unitSalePrice || 0) === 0
		);
	}

	// Auto-clear the reviewed flag when any material field changes after the
	// first render. Mirrors the server-side reset in replacePurchaseOrderItems
	// so the UI reflects the new state immediately.
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
		'w-full rounded-lg border-none bg-surface-container-high px-2.5 py-2 text-sm text-on-surface transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 disabled:cursor-not-allowed disabled:opacity-65 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none';
	const compactInputClass = `${inputClass} h-10 text-right font-mono text-sm tabular-nums`;

	const lineSubtotal = $derived(calculateDraftItemSubtotal(item));
	const lineTax = $derived(calculateDraftItemTax(item));
	const lineTotal = $derived(calculateDraftItemTotal(item));
	const lineSubtotalAlt = $derived(calculateDraftItemSubtotalAlt(item));
	const lineTaxAlt = $derived(calculateDraftItemTaxAlt(item));
	const lineTotalAlt = $derived(calculateDraftItemTotalAlt(item));
	const preTaxUnitCost = $derived(getPreTaxUnitPrice(item));
	const visiblePreTaxUnitCost = $derived(round2(preTaxUnitCost));
	const visiblePreTaxUnitCostVes = $derived(round2(Number(item.unitPurchasePriceAlt ?? 0)));
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

	function handlePreTaxInput(e: Event) {
		if (userEditingLocked) return;

		const val = getNumberInputValue(e);
		if (val !== null && val >= 0) {
			item.unitPurchasePrice = round2(val * (1 + item.ivaRate / 100));
		}
	}

	function handlePreTaxAltInput(e: Event) {
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
		'rounded-2xl border bg-surface-container-lowest p-4 shadow-sm transition-colors',
		item.isReviewed
			? 'border-success/40 bg-success-container/25 ring-1 ring-success/20'
			: 'border-outline-variant/25'
	]}
>
	<div
		class="grid gap-3 xl:grid-cols-[52px_minmax(180px,0.92fr)_80px_276px_104px_136px_148px_148px] xl:items-center xl:gap-4"
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
				disabled={userEditingLocked}
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
			{#if isAltMode}
				<div class="space-y-2">
					<div class="relative space-y-1 xl:space-y-0">
						<p
							class="text-[10px] font-semibold tracking-[0.14em] text-outline uppercase xl:pointer-events-none xl:absolute xl:top-1/2 xl:left-3 xl:z-10 xl:-translate-y-1/2"
						>
							{altInputLabel}
						</p>
						<input
							type="number"
							min="0"
							step="any"
							value={visiblePreTaxUnitCostVes}
							onchange={handlePreTaxAltInput}
							disabled={userEditingLocked}
							class={`${compactInputClass} xl:px-3.5 xl:pl-[4.8rem]`}
							aria-label={altAriaLabel}
						/>
					</div>
					<p class="text-[11px] font-medium text-on-surface-variant">
						{#if Number(bcvUsdRate || 0) > 0}
							<span class="font-mono text-brand-navy tabular-nums"
								>{formatPrice(item.unitPurchasePrice)}</span
							>
						{:else}
							Define la tasa BCV para derivar el costo USD.
						{/if}
					</p>
				</div>
			{:else if item.appliesIva}
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
							disabled={userEditingLocked}
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
							disabled={userEditingLocked}
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
					disabled={userEditingLocked}
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
				disabled={userEditingLocked}
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
					disabled={userEditingLocked}
					class={`inline-flex h-10 min-w-[3.5rem] shrink-0 items-center justify-center rounded-lg px-2.5 text-[11px] font-semibold tracking-[0.14em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-65 ${
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
						disabled={userEditingLocked}
						class="h-10 w-16 [appearance:textfield] rounded-lg border-none bg-surface-container-high px-2.5 py-2 text-right font-mono text-xs text-on-surface tabular-nums transition-colors focus:border-l-2 focus:border-l-brand-blue focus:bg-surface-container-highest focus:ring-0 disabled:cursor-not-allowed disabled:opacity-65 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
					class={`${compactInputClass} !pl-11 font-semibold text-brand-navy`}
					aria-label={isAltMode ? `Total costo en ${altSymbol}` : 'Total costo'}
					title={totalTooltip()}
				/>
			</div>
		</div>

		<div class="flex min-h-10 items-center justify-end gap-2">
			{#if hasZeroValueFields}
				<button
					type="button"
					onclick={toggleZeroPriceIntentional}
					aria-pressed={item.isZeroPriceIntentional}
					class={[
						'inline-flex h-8 items-center justify-center rounded-lg px-2.5 text-[10px] font-bold tracking-[0.12em] uppercase transition-colors',
						item.isZeroPriceIntentional
							? 'bg-brand-blue/12 text-brand-blue hover:bg-brand-blue/18'
							: 'bg-warning-container/50 text-on-warning-container hover:bg-warning-container'
					]}
					aria-label={item.isZeroPriceIntentional
						? 'Precio en cero marcado como intencional'
						: 'Marcar precio en cero como intencional'}
					title={item.isZeroPriceIntentional
						? 'Precio en 0 intencional — click para quitar la marca'
						: 'Marcar este 0 como intencional para quitar la advertencia'}
				>
					0 int.
				</button>
			{/if}
			<button
				type="button"
				onclick={toggleReviewed}
				aria-pressed={item.isReviewed}
				class={[
					'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
					item.isReviewed
						? 'bg-success-container text-on-success-container hover:bg-success/30'
						: 'text-outline hover:bg-surface-container-high hover:text-on-surface'
				]}
				aria-label={item.isReviewed ? 'Marcar como no revisada' : 'Marcar como revisada'}
				title={item.isReviewed
					? 'Línea revisada — click para desmarcar'
					: 'Marcar línea como revisada'}
			>
				<CircleCheck class="h-4 w-4" />
			</button>
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
