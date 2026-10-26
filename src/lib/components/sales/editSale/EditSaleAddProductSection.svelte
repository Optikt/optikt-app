<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { DiscountType } from '$lib/shared/enums';
	import EditSaleAddProductPanel from './EditSaleAddProductPanel.svelte';
	import { createProductItem, type EditableItem } from '../editSaleDraft';
	import { getCachedProducts } from '../catalogCache.svelte';

	interface Props {
		show: boolean;
		onAdd: (item: EditableItem) => void;
	}

	let { show = $bindable(), onAdd }: Props = $props();

	let addProductId = $state('');
	let addProductQty = $state(1);
	let addProductPrice = $state(0);
	let addProductDiscount = $state(0);
	let addProductDiscountType = $state<string>(DiscountType.FIXED);
	let addProductNotes = $state('');

	function handleProductSelect(id: string, unitPrice: number) {
		addProductId = id;
		if (unitPrice > 0) addProductPrice = unitPrice;
	}

	function reset() {
		show = false;
		addProductId = '';
		addProductQty = 1;
		addProductPrice = 0;
		addProductDiscount = 0;
		addProductDiscountType = DiscountType.FIXED;
		addProductNotes = '';
	}

	function addNewProduct() {
		if (!addProductId) {
			toast.error('Seleccione un producto');
			return;
		}
		const product = getCachedProducts().find((candidate) => candidate.id === addProductId);
		if (!product) {
			toast.error('Producto no encontrado');
			return;
		}

		onAdd(
			createProductItem(product, {
				productId: addProductId,
				quantity: addProductQty,
				unitPrice: addProductPrice,
				discount: addProductDiscount,
				discountType: addProductDiscountType,
				notes: addProductNotes
			})
		);
		reset();
		toast.success('Producto agregado');
	}
</script>

<EditSaleAddProductPanel
	bind:showAddProduct={show}
	bind:addProductId
	bind:addProductQty
	bind:addProductPrice
	bind:addProductDiscount
	bind:addProductDiscountType
	bind:addProductNotes
	onSelectProduct={handleProductSelect}
	onAddProduct={addNewProduct}
	onCancel={reset}
/>
