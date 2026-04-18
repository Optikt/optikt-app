<script lang="ts">
	import { Save, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { nowUTC, toISODate } from '$lib/dates';
	import { PageHeader } from '$lib/components/ui';
	import { createPurchaseOrderCmd } from '$lib/remote/purchaseOrders.remote';
	import { PurchaseOrderItemType, PurchaseDocumentType } from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { getErrorMessage } from '$lib/utils';
	import PurchaseOrderDocumentPanel from './PurchaseOrderDocumentPanel.svelte';
	import PurchaseOrderItemsPanel from './PurchaseOrderItemsPanel.svelte';
	import PurchaseOrderSummaryPanel from './PurchaseOrderSummaryPanel.svelte';
	import {
		calculatePurchaseOrderSummary,
		isDraftItemConfigured,
		type PurchaseOrderDraftItem
	} from './purchaseOrderDraft';

	type SupplierOption = {
		id: string;
		name: string;
	};

	interface Props {
		suppliers: SupplierOption[];
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
	}

	let { suppliers, products, lensItems }: Props = $props();

	let supplierId = $state('');
	let documentType = $state(PurchaseDocumentType.INVOICE);
	let invoiceNumber = $state('');
	let deliveryNoteNumber = $state('');
	let orderDate = $state(toISODate(nowUTC()));
	let bcvRate = $state<number>(0);
	let notes = $state('');
	let saving = $state(false);
	let items = $state<PurchaseOrderDraftItem[]>([]);

	const summary = $derived(calculatePurchaseOrderSummary(items));
	const supplierLocked = $derived(items.length > 0);

	const canSave = $derived(
		supplierId !== '' &&
			orderDate !== '' &&
			bcvRate > 0 &&
			notes.length >= 6 &&
			items.length > 0 &&
			items.every(
				(item) =>
					isDraftItemConfigured(item) &&
					Number(item.quantity) >= 1 &&
					Number(item.unitPurchasePrice) >= 0 &&
					Number(item.unitSalePrice) >= 0 &&
					(!item.appliesIva || Number(item.ivaRate) >= 0)
			)
	);

	function goBack() {
		void goto(resolve('/purchases'));
	}

	async function handleSave() {
		if (!canSave || saving) return;
		saving = true;

		try {
			const result = await createPurchaseOrderCmd({
				supplierId,
				documentType,
				invoiceNumber: invoiceNumber || undefined,
				deliveryNoteNumber: deliveryNoteNumber || undefined,
				orderDate,
				bcvRate,
				notes,
				items: items.map((item) => ({
					itemType: item.itemType,
					productId:
						item.itemType === PurchaseOrderItemType.PRODUCT
							? item.productId || undefined
							: undefined,
					lensCatalogItemId:
						item.itemType === PurchaseOrderItemType.LENS
							? item.lensCatalogItemId || undefined
							: undefined,
					quantity: item.quantity,
					unitPurchasePrice: item.unitPurchasePrice,
					unitSalePrice: item.unitSalePrice,
					appliesIva: item.appliesIva,
					ivaRate: item.ivaRate
				}))
			});

			if (result.success) {
				toast.success('Orden de compra creada exitosamente');
				void goto(resolve(`/purchases/${result.purchaseOrder.id}`));
				return;
			}

			toast.error(result.error ?? 'Error creando la orden de compra');
		} catch (error) {
			console.error(error);
			toast.error(getErrorMessage(error, 'Error creando orden de compra'));
		} finally {
			saving = false;
		}
	}
</script>

<div class="space-y-6 p-6">
	<PageHeader title="Crear Orden de Compra" backLabel="Volver a órdenes" backOnClick={goBack}>
		{#snippet actions()}
			<button
				type="button"
				onclick={goBack}
				class="inline-flex items-center gap-2 rounded-xl bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-brand-navy ring-1 ring-outline-variant/30 transition-colors hover:bg-surface-container-high"
			>
				<X class="h-4 w-4" />
				Cancelar
			</button>
			<button
				type="button"
				onclick={handleSave}
				disabled={!canSave || saving}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
			>
				<Save class="h-4 w-4" />
				{saving ? 'Guardando...' : 'Guardar orden (borrador)'}
			</button>
		{/snippet}
	</PageHeader>

	<div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
		<div
			class="inline-flex items-center gap-2 self-start rounded-full bg-surface-container-high px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
		>
			Se guarda primero como borrador
		</div>
	</div>

	<div class="space-y-5">
		<PurchaseOrderDocumentPanel
			{suppliers}
			bind:supplierId
			bind:documentType
			bind:orderDate
			bind:bcvRate
			bind:invoiceNumber
			bind:deliveryNoteNumber
			bind:notes
			{supplierLocked}
		/>

		<PurchaseOrderItemsPanel bind:items {products} {lensItems} {supplierId} {documentType} />

		<PurchaseOrderSummaryPanel {summary} {bcvRate} />
	</div>
</div>
