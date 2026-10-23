<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { DiscountType } from '$lib/shared/enums';
	import { FreeItemCategory } from '$lib/shared/enums/lensTypes';
	import EditSaleAddFreeItemPanel from './EditSaleAddFreeItemPanel.svelte';
	import { createFreeItem, type EditableItem } from '../editSaleDraft';

	interface Props {
		show: boolean;
		onAdd: (item: EditableItem) => void;
	}

	let { show = $bindable(), onAdd }: Props = $props();

	let addFreeCategory = $state<FreeItemCategory>(FreeItemCategory.CONTACT_LENS_FORMULA);
	let addFreeDescription = $state('');
	let addFreePrice = $state(0);
	let addFreeDiscount = $state(0);
	let addFreeDiscountType = $state<string>(DiscountType.FIXED);
	let addFreeNotes = $state('');

	function reset() {
		show = false;
		addFreeCategory = FreeItemCategory.CONTACT_LENS_FORMULA;
		addFreeDescription = '';
		addFreePrice = 0;
		addFreeDiscount = 0;
		addFreeDiscountType = DiscountType.FIXED;
		addFreeNotes = '';
	}

	function addNewFreeItem() {
		if (!addFreeDescription.trim() || addFreeDescription.trim().length < 3) {
			toast.error('La descripción debe tener al menos 3 caracteres');
			return;
		}
		if (addFreePrice <= 0) {
			toast.error('El precio de venta debe ser mayor a 0');
			return;
		}

		onAdd(
			createFreeItem({
				category: addFreeCategory,
				description: addFreeDescription,
				price: addFreePrice,
				discount: addFreeDiscount,
				discountType: addFreeDiscountType,
				notes: addFreeNotes
			})
		);
		reset();
		toast.success('Ítem libre agregado');
	}
</script>

<EditSaleAddFreeItemPanel
	showAddFreeItem={show}
	bind:addFreeCategory
	bind:addFreeDescription
	bind:addFreePrice
	bind:addFreeDiscount
	bind:addFreeDiscountType
	bind:addFreeNotes
	onAddFreeItem={addNewFreeItem}
	onCancel={reset}
/>
