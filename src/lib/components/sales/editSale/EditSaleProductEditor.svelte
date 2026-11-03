<script lang="ts">
	import { untrack } from 'svelte';
	import { DiscountType } from '$lib/shared/enums';
	import ItemSelect from '../ItemSelect.svelte';
	import PriceQtyFields from '$lib/components/commercialDocument/PriceQtyFields.svelte';
	import { getCachedProducts } from '../catalogCache.svelte';
	import { SaleItemUnitPriceSchema } from '$lib/schemas/sales';
	import { SALE_CAPABILITIES } from '$lib/components/documentEditor/types';
	import type { EditableItem } from '../editSaleDraft';

	interface Props {
		item: EditableItem;
		mode: 'add' | 'edit';
		onCommit: (item: EditableItem) => void;
	}

	let { item, mode, onCommit }: Props = $props();

	let productId = $state(untrack(() => item.productId ?? ''));
	let quantity = $state(untrack(() => item.quantity));
	let unitPrice = $state(untrack(() => item.unitPrice));
	let discount = $state(untrack(() => item.discount ?? 0));
	let discountType = $state<string>(untrack(() => item.discountType ?? DiscountType.FIXED));
	let error = $state('');

	const snapshotLabel = $derived(
		item.snapshotName
			? item.snapshotSku
				? `${item.snapshotName} (${item.snapshotSku})`
				: item.snapshotName
			: ''
	);

	const product = $derived(
		productId ? getCachedProducts().find((candidate) => candidate.id === productId) : undefined
	);

	function selectProduct(id: string, catalogPrice: number) {
		error = '';
		productId = id;
		if (id && unitPrice <= 0 && catalogPrice > 0) unitPrice = catalogPrice;
	}

	/** Exposed for the item band's «Hecho» button. */
	export function apply() {
		commit();
	}

	function commit() {
		if (!productId) {
			error = 'Selecciona un producto del catálogo.';
			return;
		}
		if (!SaleItemUnitPriceSchema.safeParse(unitPrice).success) {
			error = 'Precio debe ser mayor o igual a 0';
			return;
		}
		const found = getCachedProducts().find((candidate) => candidate.id === productId);
		onCommit({
			...item,
			/** Placeholders join the basket with a local id (same as lens apply). */
			id: item.id ?? crypto.randomUUID(),
			productId,
			quantity,
			unitPrice,
			discount,
			discountType: discountType as DiscountType,
			snapshotName: found?.name ?? item.snapshotName,
			snapshotSku: found?.sku ?? item.snapshotSku,
			snapshotBrand: found?.brand?.name ?? item.snapshotBrand,
			snapshotIsTaxable: found?.isTaxable ?? item.snapshotIsTaxable
		});
	}
</script>

<div
	class="rounded-xl bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(21,35,70,0.06),0_2px_8px_rgba(21,35,70,0.06)]"
>
	<div class="flex flex-wrap items-end gap-2.5">
		<div class="min-w-[220px] flex-[2]">
			<ItemSelect
				kind="product"
				value={productId}
				{snapshotLabel}
				onselect={selectProduct}
				label="Producto"
			/>
			{#if SALE_CAPABILITIES.inventory && mode === 'add'}
				<p class="mt-1.5 text-[11px] text-on-warning-container">
					Los productos nuevos consumirán inventario al guardar.
				</p>
			{/if}
		</div>

		<PriceQtyFields
			{unitPrice}
			{quantity}
			{discount}
			{discountType}
			onPrice={(value) => {
				error = '';
				unitPrice = value;
			}}
			onQty={(value) => {
				error = '';
				quantity = value;
			}}
			onDiscount={(value) => {
				error = '';
				discount = value;
			}}
			onDiscountType={(value) => {
				error = '';
				discountType = value;
			}}
			referencePrice={product?.currentSalePrice ?? undefined}
		/>
	</div>

	{#if error}
		<p class="mt-1.5 text-[10.5px] text-red-600 dark:text-red-400">{error}</p>
	{/if}
</div>
