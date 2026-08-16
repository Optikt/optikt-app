<script lang="ts">
	import { untrack, onMount } from 'svelte';
	import { NewPurchaseOrderForm } from '$lib/components/purchases';
	import {
		createPurchaseOrderDraftItemFromExisting,
		type PurchaseOrderDraftInitialValues
	} from '$lib/components/purchases/purchaseOrderDraft';
	import { getCatalogItemsByIds } from '$lib/remote/catalog.remote';
	import { cacheCatalogItems } from '$lib/components/sales/catalogCache.svelte';
	import {
		PurchaseDiscountType,
		PurchaseDocumentType,
		PurchasePaymentTerms
	} from '$lib/shared/enums';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let { purchaseOrder, items, suppliers } = untrack(() => data);

	// Seed the catalog cache with the items already in this purchase order so
	// titles/SKUs render without fetching the full catalog.
	onMount(() => {
		const productIds = items
			.filter((i) => i.itemType === 'PRODUCT' && i.productId)
			.map((i) => i.productId as string);
		const lensIds = items
			.filter((i) => i.lensCatalogItemId)
			.map((i) => i.lensCatalogItemId as string);
		if (productIds.length === 0 && lensIds.length === 0) return;
		void getCatalogItemsByIds({ productIds, lensIds }).then((results) =>
			cacheCatalogItems(results.products, results.lensItems)
		);
	});

	const initialDraft: PurchaseOrderDraftInitialValues = {
		supplierId: purchaseOrder.supplierId,
		documentType: purchaseOrder.documentType as PurchaseDocumentType,
		invoiceNumber: purchaseOrder.invoiceNumber ?? '',
		deliveryNoteNumber: purchaseOrder.deliveryNoteNumber ?? '',
		orderDate: purchaseOrder.orderDate.slice(0, 10),
		bcvRate: purchaseOrder.bcvRate,
		sourceCurrency: purchaseOrder.sourceCurrency ?? 'USD',
		sourceRateToVes: purchaseOrder.sourceRateToVes ?? 0,
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

<NewPurchaseOrderForm {suppliers} mode="edit" purchaseOrderId={purchaseOrder.id} {initialDraft} />
