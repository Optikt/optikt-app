<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import SaleStep3Summary from '$lib/components/sales/SaleStep3Summary.svelte';
	import type { SaleItemRow, NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import { fromISODate } from '$lib/dates';
	import type { DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { Customer } from '$lib/server/db/schema';

	interface Props {
		items: SaleItemRow[];
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		quoteDate: Date;
		discount: number;
		discountType: DiscountTypeEnum;
		notes: string;
		validUntil: string;
		nextQuoteNumber?: number;
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		submitting: boolean;
		canSubmit: boolean;
		onprev: () => void;
		onsubmit: () => void;
	}

	let {
		items,
		selectedCustomer,
		newCustomer,
		quoteDate,
		discount = $bindable(),
		discountType = $bindable(),
		notes,
		validUntil,
		nextQuoteNumber,
		products,
		lensItems,
		submitting,
		canSubmit,
		onprev,
		onsubmit
	}: Props = $props();

	const quoteReference = $derived.by(() => (nextQuoteNumber ? `P-${nextQuoteNumber}` : undefined));

	const validUntilDate = $derived.by(() => fromISODate(validUntil) ?? null);

	function goToQuotes() {
		goto(resolve('/quotes'));
	}
</script>

<SaleStep3Summary
	{items}
	{selectedCustomer}
	{newCustomer}
	saleDate={quoteDate}
	bind:discount
	bind:discountType
	{notes}
	nextOrderNumber={nextQuoteNumber}
	entityLabel="Presupuesto"
	entityValue={quoteReference}
	customerFallbackName="Presupuesto sin cliente"
	customerFallbackDocument="Cliente opcional"
	submittingStatusLabel="Creando presupuesto"
	readyStatusLabel="Listo para crear"
	pendingStatusLabel="Revisa el presupuesto"
	adjustmentsEyebrow="Ajustes del presupuesto"
	adjustmentsTitle="Cierre del presupuesto"
	totalCardEyebrow="Total estimado"
	primaryLabel="Crear Presupuesto"
	onCancel={goToQuotes}
	secondaryContextDate={validUntilDate}
	secondaryContextLabel={validUntilDate ? 'Valido hasta' : undefined}
	{products}
	{lensItems}
	{submitting}
	{canSubmit}
	{onprev}
	{onsubmit}
/>
