<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SaleStep3Summary from '$lib/components/sales/step3/SaleStep3Summary.svelte';
	import type { SaleItemRow, NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import type { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import type { Customer } from '$lib/server/db/schema';

	interface Props {
		items: SaleItemRow[];
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		discount: number;
		discountType: DiscountTypeEnum;
		notes: string;
		defaultTaxRate?: number;
		submitting: boolean;
		canSubmit: boolean;
		onprev: () => void;
		onsubmit: () => void;
	}

	let {
		items,
		selectedCustomer,
		newCustomer,
		discount = $bindable(),
		discountType = $bindable(),
		notes,
		defaultTaxRate,
		submitting,
		canSubmit,
		onprev,
		onsubmit
	}: Props = $props();



	function goToQuotes() {
		goto(resolve('/quotes'));
	}
</script>

<SaleStep3Summary
	{items}
	{selectedCustomer}
	{newCustomer}
	bind:discount
	bind:discountType
	{notes}
	{defaultTaxRate}
	customerFallbackName="Presupuesto sin cliente"
	customerFallbackDocument="Cliente opcional"
	submittingStatusLabel="Creando presupuesto"
	readyStatusLabel="Listo para crear"
	pendingStatusLabel="Revisa el presupuesto"
	primaryLabel="Crear Presupuesto"
	onCancel={goToQuotes}
	{submitting}
	{canSubmit}
	{onprev}
	{onsubmit}
/>
