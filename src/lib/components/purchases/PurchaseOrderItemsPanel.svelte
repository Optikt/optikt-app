<script lang="ts">
	import { Plus } from '@lucide/svelte';
	import { AppBadge, BaseSelect } from '$lib/components/ui';
	import { PurchaseDocumentType, PurchaseOrderItemType } from '$lib/shared/enums';
	import { getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import PurchaseOrderItemRow from './PurchaseOrderItemRow.svelte';
	import {
		applyLensDefaults,
		applyProductDefaults,
		createEmptyPurchaseOrderDraftItem,
		type PurchaseOrderDraftItem
	} from './purchaseOrderDraft';
	import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

	type SelectOption = {
		id: string;
		label: string;
	};

	type SelectChange = SelectOption | SelectOption[] | string | string[] | null | undefined;

	interface Props {
		items: PurchaseOrderDraftItem[];
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		supplierId: string;
		documentType: PurchaseDocumentType;
		defaultTaxRate?: number;
	}

	let {
		items = $bindable(),
		products,
		lensItems,
		supplierId,
		documentType,
		defaultTaxRate = DEFAULT_TAX_RATE
	}: Props = $props();

	let pendingItemType = $state(PurchaseOrderItemType.PRODUCT);
	let pendingProductId = $state('');
	let pendingLensCatalogItemId = $state('');

	const supplierProducts = $derived(
		supplierId === '' ? [] : products.filter((product) => product.supplierId === supplierId)
	);

	const supplierLensItems = $derived(
		supplierId === '' ? [] : lensItems.filter((lens) => lens.supplierId === supplierId)
	);

	const addedProductIds = $derived(new Set(items.map((i) => i.productId).filter(Boolean)));
	const addedLensIds = $derived(new Set(items.map((i) => i.lensCatalogItemId).filter(Boolean)));

	const productOptions = $derived(
		supplierProducts
			.filter((product) => !addedProductIds.has(product.id))
			.map((product) => ({
				id: product.id,
				label: `${product.sku} - ${product.name}`
			}))
	);

	const lensOptions = $derived(
		supplierLensItems
			.filter((lens) => !addedLensIds.has(lens.id))
			.map((lens) => ({
				id: lens.id,
				label: `${lens.name} - ${getLensTypeLabel(lens.type)}`
			}))
	);

	const selectedProduct = $derived(
		supplierProducts.find((product) => product.id === pendingProductId) ?? null
	);

	const selectedLens = $derived(
		supplierLensItems.find((lens) => lens.id === pendingLensCatalogItemId) ?? null
	);

	const visibleProductValue = $derived(
		supplierProducts.some((product) => product.id === pendingProductId) ? pendingProductId : ''
	);

	const visibleLensValue = $derived(
		supplierLensItems.some((lens) => lens.id === pendingLensCatalogItemId)
			? pendingLensCatalogItemId
			: ''
	);

	const canAddLine = $derived(
		supplierId !== '' &&
			(pendingItemType === PurchaseOrderItemType.PRODUCT
				? selectedProduct !== null
				: selectedLens !== null)
	);

	const currentOptionCount = $derived(
		pendingItemType === PurchaseOrderItemType.PRODUCT ? productOptions.length : lensOptions.length
	);

	function normalizeSelectValue(selected: SelectChange): string {
		if (typeof selected === 'string') {
			return selected;
		}

		if (Array.isArray(selected)) {
			const first = selected[0];

			if (typeof first === 'string') {
				return first;
			}

			return first?.id ?? '';
		}

		if (selected && typeof selected === 'object' && 'id' in selected) {
			return selected.id;
		}

		return '';
	}

	function setPendingType(itemType: PurchaseOrderItemType) {
		if (pendingItemType === itemType) return;
		pendingItemType = itemType;
		pendingProductId = '';
		pendingLensCatalogItemId = '';
	}

	function addLine() {
		if (!canAddLine) return;

		const nextItem = createEmptyPurchaseOrderDraftItem(
			pendingItemType,
			documentType,
			defaultTaxRate
		);

		if (pendingItemType === PurchaseOrderItemType.PRODUCT && selectedProduct) {
			applyProductDefaults(nextItem, selectedProduct, documentType, defaultTaxRate);
			pendingProductId = '';
		} else if (pendingItemType === PurchaseOrderItemType.LENS && selectedLens) {
			applyLensDefaults(nextItem, selectedLens, documentType, defaultTaxRate);
			pendingLensCatalogItemId = '';
		}

		items = [...items, nextItem];
	}

	function removeLine(itemId: string) {
		items = items.filter((item) => item.id !== itemId);
	}
</script>

<section class="glass-card bg-surface-container-lowest p-5 sm:p-6">
	<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
		<div>
			<div class="flex items-center gap-3">
				<h2 class="text-xl font-semibold text-brand-navy">Artículos</h2>
				<AppBadge variant="neutral">{items.length} líneas</AppBadge>
			</div>
		</div>
	</div>

	<div class="mt-5 rounded-2xl bg-surface-container-low p-4 ring-1 ring-outline-variant/20">
		<div class="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)_auto] xl:items-center">
			<div class="inline-flex rounded-xl bg-surface-container-high p-1">
				{#each Object.values(PurchaseOrderItemType) as itemType (itemType)}
					<button
						type="button"
						onclick={() => setPendingType(itemType)}
						class={`rounded-lg px-3 py-2 text-xs font-semibold tracking-[0.14em] uppercase transition-colors ${
							pendingItemType === itemType
								? 'bg-brand-navy text-white'
								: 'text-on-surface-variant hover:text-brand-navy'
						}`}
					>
						{itemType === PurchaseOrderItemType.PRODUCT ? 'Producto' : 'Lente'}
					</button>
				{/each}
			</div>

			<div class="min-w-0">
				{#if pendingItemType === PurchaseOrderItemType.PRODUCT}
					<BaseSelect
						value={visibleProductValue}
						options={productOptions as SelectOption[]}
						valueField="id"
						labelField="label"
						placeholder={supplierId === ''
							? 'Selecciona un proveedor primero'
							: 'Buscar producto del proveedor...'}
						variant="tonal"
						disabled={supplierId === '' || productOptions.length === 0}
						onChange={(selected) => {
							pendingProductId = normalizeSelectValue(selected as SelectChange);
						}}
					/>
				{:else}
					<BaseSelect
						value={visibleLensValue}
						options={lensOptions as SelectOption[]}
						valueField="id"
						labelField="label"
						placeholder={supplierId === ''
							? 'Selecciona un proveedor primero'
							: 'Buscar lente del proveedor...'}
						variant="tonal"
						disabled={supplierId === '' || lensOptions.length === 0}
						onChange={(selected) => {
							pendingLensCatalogItemId = normalizeSelectValue(selected as SelectChange);
						}}
					/>
				{/if}
			</div>

			<button
				type="button"
				onclick={addLine}
				disabled={!canAddLine}
				class="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
			>
				<Plus class="h-4 w-4" />
				Agregar línea
			</button>
		</div>

		<p class="mt-3 text-xs leading-5 text-on-surface-variant">
			{#if supplierId === ''}
				Selecciona un proveedor para habilitar el catálogo disponible.
			{:else if currentOptionCount === 0}
				Este proveedor no tiene {pendingItemType === PurchaseOrderItemType.PRODUCT
					? 'productos'
					: 'lentes'} disponibles para agregar.
			{:else}
				{currentOptionCount}
				{pendingItemType === PurchaseOrderItemType.PRODUCT ? 'productos' : 'lentes'} del proveedor listos
				para búsqueda y agregado.
			{/if}
		</p>
	</div>

	<div class="mt-5 space-y-3">
		{#if items.length === 0}
			<div
				class="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low px-5 py-8 text-center text-sm text-on-surface-variant"
			>
				Todavía no hay líneas en la orden. Busca un artículo arriba y agrégalo a la lista.
			</div>
		{:else}
			<div class="overflow-x-auto pb-1">
				<div class="min-w-[960px] space-y-4">
					<div
						class="hidden xl:grid xl:grid-cols-[52px_minmax(180px,0.92fr)_80px_276px_104px_104px_128px_32px] xl:gap-4"
					>
						{#each ['Tipo', 'Artículo', 'Cant.', 'Costo', 'Venta', 'IVA', 'Total', ''] as label, index (label + index)}
							<div
								class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
							>
								{label}
							</div>
						{/each}
					</div>

					{#each items as item, index (item.id)}
						<PurchaseOrderItemRow
							bind:item={items[index]}
							product={products.find((product) => product.id === item.productId) ?? null}
							lensItem={lensItems.find((lens) => lens.id === item.lensCatalogItemId) ?? null}
							showRemove={true}
							onremove={() => removeLine(item.id)}
						/>
					{/each}
				</div>
			</div>
		{/if}
	</div>
</section>
