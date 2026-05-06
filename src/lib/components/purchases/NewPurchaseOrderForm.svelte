<script lang="ts">
	import { AlertTriangle, Save, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { nowUTC, toISODate } from '$lib/dates';
	import { ConfirmModal, PageHeader } from '$lib/components/ui';
	import { createPurchaseOrderCmd } from '$lib/remote/purchaseOrders.remote';
	import { PurchaseOrderItemType, PurchaseDocumentType } from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import PurchaseOrderDocumentPanel from './PurchaseOrderDocumentPanel.svelte';
	import PurchaseOrderItemsPanel from './PurchaseOrderItemsPanel.svelte';
	import PurchaseOrderSummaryPanel from './PurchaseOrderSummaryPanel.svelte';
	import {
		calculatePurchaseOrderSummary,
		getDraftItemZeroValueFields,
		isDraftItemConfigured,
		type PurchaseOrderDraftZeroValueField,
		type PurchaseOrderDraftItem
	} from './purchaseOrderDraft';
	import { DEFAULT_TAX_RATE } from '$lib/shared/tax';

	type SupplierOption = {
		id: string;
		name: string;
	};

	type ZeroValueWarningLine = {
		id: string;
		title: string;
		quantity: number;
		unitPurchasePrice: number;
		unitSalePrice: number;
		fields: PurchaseOrderDraftZeroValueField[];
	};

	const ZERO_VALUE_FIELD_LABELS: Record<PurchaseOrderDraftZeroValueField, string> = {
		unitPurchasePrice: 'Costo und. en 0',
		unitSalePrice: 'Venta und. en 0'
	};

	interface Props {
		suppliers: SupplierOption[];
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		defaultTaxRate?: number;
	}

	let { suppliers, products, lensItems, defaultTaxRate = DEFAULT_TAX_RATE }: Props = $props();

	let supplierId = $state('');
	let documentType = $state(PurchaseDocumentType.INVOICE);
	let invoiceNumber = $state('');
	let deliveryNoteNumber = $state('');
	let orderDate = $state(toISODate(nowUTC()));
	let bcvRate = $state<number>(0);
	let notes = $state('');
	let saving = $state(false);
	let showZeroValueWarningModal = $state(false);
	let items = $state<PurchaseOrderDraftItem[]>([]);

	const summary = $derived(calculatePurchaseOrderSummary(items));
	const supplierLocked = $derived(items.length > 0);
	const zeroValueWarningLines = $derived(
		items
			.map((item) => buildZeroValueWarningLine(item))
			.filter((line): line is ZeroValueWarningLine => line !== null)
	);

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

	function getDraftItemTitle(item: PurchaseOrderDraftItem): string {
		if (item.itemType === PurchaseOrderItemType.PRODUCT) {
			const product = products.find((candidate) => candidate.id === item.productId);
			return product ? `${product.sku} - ${product.name}` : 'Producto seleccionado';
		}

		const lensItem = lensItems.find((candidate) => candidate.id === item.lensCatalogItemId);
		return lensItem ? lensItem.name : 'Lente seleccionado';
	}

	function buildZeroValueWarningLine(item: PurchaseOrderDraftItem): ZeroValueWarningLine | null {
		const fields = getDraftItemZeroValueFields(item);

		if (fields.length === 0) return null;

		return {
			id: item.id,
			title: getDraftItemTitle(item),
			quantity: Number(item.quantity || 0),
			unitPurchasePrice: Number(item.unitPurchasePrice || 0),
			unitSalePrice: Number(item.unitSalePrice || 0),
			fields
		};
	}

	function handleSaveClick() {
		if (!canSave || saving) return;

		if (zeroValueWarningLines.length > 0) {
			showZeroValueWarningModal = true;
			return;
		}

		void savePurchaseOrder();
	}

	function handleZeroValueWarningConfirm() {
		showZeroValueWarningModal = false;
		void savePurchaseOrder();
	}

	async function savePurchaseOrder() {
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
				onclick={handleSaveClick}
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

		<PurchaseOrderItemsPanel
			bind:items
			{products}
			{lensItems}
			{supplierId}
			{documentType}
			{defaultTaxRate}
		/>

		<PurchaseOrderSummaryPanel {summary} {bcvRate} />
	</div>
</div>

<ConfirmModal
	bind:open={showZeroValueWarningModal}
	title="Valores en cero"
	size="lg"
	confirmLabel="Guardar de todos modos"
	cancelLabel="Revisar orden"
	confirmColor="yellow"
	loading={saving}
	onConfirm={handleZeroValueWarningConfirm}
	onCancel={() => (showZeroValueWarningModal = false)}
	permanent
>
	{#snippet icon()}
		<div
			class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-warning-container text-on-warning-container"
		>
			<AlertTriangle class="h-5 w-5" />
		</div>
	{/snippet}

	{#snippet body()}
		<div class="space-y-4 text-sm text-on-surface">
			<p>
				Estas líneas tienen costo o venta en cero. Revisa si son correctas antes de crear el
				borrador.
			</p>

			<div class="max-h-72 space-y-2 overflow-y-auto pr-1">
				{#each zeroValueWarningLines as line (line.id)}
					<div class="rounded-lg border border-warning/25 bg-warning-container/30 p-3">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0">
								<p class="truncate font-mono text-xs font-semibold text-brand-navy">
									{line.title}
								</p>
								<p class="mt-1 text-xs text-on-surface-variant">Cantidad: {line.quantity}</p>
							</div>
							<div class="flex shrink-0 flex-wrap justify-end gap-1">
								{#each line.fields as field (field)}
									<span
										class="text-on-warning rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold tracking-[0.12em] uppercase"
									>
										{ZERO_VALUE_FIELD_LABELS[field]}
									</span>
								{/each}
							</div>
						</div>

						<div class="mt-3 grid grid-cols-2 gap-2 text-xs">
							<div class="rounded-md bg-surface-container-lowest px-2 py-1.5">
								<span class="text-on-surface-variant">Costo und.</span>
								<p class="font-mono font-semibold tabular-nums">
									{formatPrice(line.unitPurchasePrice)}
								</p>
							</div>
							<div class="rounded-md bg-surface-container-lowest px-2 py-1.5">
								<span class="text-on-surface-variant">Venta und.</span>
								<p class="font-mono font-semibold tabular-nums">
									{formatPrice(line.unitSalePrice)}
								</p>
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/snippet}
</ConfirmModal>
