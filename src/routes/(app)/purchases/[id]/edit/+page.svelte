<script lang="ts">
	import { untrack } from 'svelte';
	import { NewPurchaseOrderForm } from '$lib/components/purchases';
	import {
		createPurchaseOrderDraftItemFromExisting,
		type PurchaseOrderDraftInitialValues
	} from '$lib/components/purchases/purchaseOrderDraft';
	import {
		PurchaseDiscountType,
		PurchaseDocumentType,
		PurchasePaymentTerms
	} from '$lib/shared/enums';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let { purchaseOrder, items, suppliers, products, lensItems } = untrack(() => data);

	const initialDraft: PurchaseOrderDraftInitialValues = {
		supplierId: purchaseOrder.supplierId,
		documentType: purchaseOrder.documentType as PurchaseDocumentType,
		invoiceNumber: purchaseOrder.invoiceNumber ?? '',
		deliveryNoteNumber: purchaseOrder.deliveryNoteNumber ?? '',
		orderDate: purchaseOrder.orderDate.slice(0, 10),
		bcvRate: purchaseOrder.bcvRate,
		sourceCurrency: purchaseOrder.sourceCurrency ?? 'USD',
		altRate: purchaseOrder.altRate ?? 0,
		notes: purchaseOrder.notes ?? '',
		paymentTerms: (purchaseOrder.paymentTerms ??
			PurchasePaymentTerms.CONTADO) as PurchasePaymentTerms,
		creditDueDate: purchaseOrder.creditDueDate,
		earlyPaymentDiscountPercent: purchaseOrder.earlyPaymentDiscountPercent,
		earlyPaymentDiscountDeadline: purchaseOrder.earlyPaymentDiscountDeadline,
		discount: {
			type: (purchaseOrder.settlementDiscountType ??
				PurchaseDiscountType.NONE) as PurchaseDiscountType,
			value: Number(purchaseOrder.settlementDiscountValue ?? 0)
		},
		discountNotes: purchaseOrder.settlementDiscountNotes ?? null,
		items: items.map(createPurchaseOrderDraftItemFromExisting)
	};
</script>

<svelte:head>
	<title>Editar PO-{String(purchaseOrder.orderNumber).padStart(4, '0')} - Optikt</title>
</svelte:head>

<NewPurchaseOrderForm
	{suppliers}
	{products}
	{lensItems}
	mode="edit"
	purchaseOrderId={purchaseOrder.id}
	{initialDraft}
/>
