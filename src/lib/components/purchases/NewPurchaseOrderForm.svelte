<script lang="ts">
	import { AlertTriangle, CheckCircle2, Save, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { nowUTC, toISODate } from '$lib/dates';
	import { ConfirmModal, PageHeader } from '$lib/components/ui';
	import {
		createPurchaseOrderCmd,
		markPurchaseOrderReadyCmd,
		savePurchaseOrderDraftCmd
	} from '$lib/remote/purchaseOrders.remote';
	import { PurchaseOrderItemType, PurchaseDocumentType } from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import PurchaseOrderDocumentPanel from './PurchaseOrderDocumentPanel.svelte';
	import PurchaseOrderItemsPanel from './PurchaseOrderItemsPanel.svelte';
	import PurchaseOrderSummaryPanel from './PurchaseOrderSummaryPanel.svelte';
	import {
		calculatePurchaseOrderSummary,
		canPersistPurchaseOrderDraft,
		getDraftItemZeroValueFields,
		type PurchaseOrderDraftInitialValues,
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
		mode?: 'create' | 'edit';
		purchaseOrderId?: string;
		initialDraft?: PurchaseOrderDraftInitialValues;
	}

	let {
		suppliers,
		products,
		lensItems,
		defaultTaxRate = DEFAULT_TAX_RATE,
		mode = 'create',
		purchaseOrderId,
		initialDraft
	}: Props = $props();
	const initialValues = untrack(() => initialDraft);

	let supplierId = $state(initialValues?.supplierId ?? '');
	let documentType = $state(initialValues?.documentType ?? PurchaseDocumentType.INVOICE);
	let invoiceNumber = $state(initialValues?.invoiceNumber ?? '');
	let deliveryNoteNumber = $state(initialValues?.deliveryNoteNumber ?? '');
	let orderDate = $state(initialValues?.orderDate ?? toISODate(nowUTC()));
	let bcvRate = $state<number>(initialValues?.bcvRate ?? 0);
	let notes = $state(initialValues?.notes ?? '');
	let savingAction = $state<'draft' | 'ready' | null>(null);
	let showZeroValueWarningModal = $state(false);
	let pendingMarkReady = $state(false);
	let items = $state<PurchaseOrderDraftItem[]>(initialValues?.items ?? []);

	const summary = $derived(calculatePurchaseOrderSummary(items));
	const supplierLocked = $derived(items.length > 0);
	const isEdit = $derived(mode === 'edit');
	const saving = $derived(savingAction !== null);
	const zeroValueWarningLines = $derived(
		items
			.map((item) => buildZeroValueWarningLine(item))
			.filter((line): line is ZeroValueWarningLine => line !== null)
	);

	const canSave = $derived(
		canPersistPurchaseOrderDraft({ supplierId, orderDate, bcvRate, notes }, items)
	);

	function goBack() {
		if (isEdit && purchaseOrderId) {
			void goto(resolve(`/purchases/${purchaseOrderId}`));
			return;
		}

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

	function handleSaveClick(markReady = false) {
		if (!canSave || saving) return;
		pendingMarkReady = markReady;

		if (zeroValueWarningLines.length > 0) {
			showZeroValueWarningModal = true;
			return;
		}

		void savePurchaseOrder(markReady);
	}

	function handleZeroValueWarningConfirm() {
		showZeroValueWarningModal = false;
		void savePurchaseOrder(pendingMarkReady);
	}

	function buildItemsPayload() {
		return items.map((item) => ({
			id: item.persistedId,
			itemType: item.itemType,
			productId:
				item.itemType === PurchaseOrderItemType.PRODUCT ? item.productId || undefined : undefined,
			lensCatalogItemId:
				item.itemType === PurchaseOrderItemType.LENS
					? item.lensCatalogItemId || undefined
					: undefined,
			quantity: item.quantity,
			unitPurchasePrice: item.unitPurchasePrice,
			unitSalePrice: item.unitSalePrice,
			appliesIva: item.appliesIva,
			ivaRate: item.ivaRate,
			isReviewed: item.isReviewed
		}));
	}

	async function savePurchaseOrder(markReady = false) {
		if (!canSave || saving) return;
		savingAction = markReady ? 'ready' : 'draft';

		try {
			if (isEdit) {
				if (!purchaseOrderId) {
					toast.error('Orden de compra no encontrada');
					return;
				}

				const result = await savePurchaseOrderDraftCmd({
					id: purchaseOrderId,
					supplierId,
					documentType,
					invoiceNumber: invoiceNumber || undefined,
					deliveryNoteNumber: deliveryNoteNumber || undefined,
					orderDate,
					bcvRate,
					notes,
					items: buildItemsPayload()
				});

				if (!result.success) {
					toast.error(result.error ?? 'Error guardando el borrador');
					return;
				}

				if (markReady) {
					const readyResult = await markPurchaseOrderReadyCmd({ id: purchaseOrderId });
					if (!readyResult.success) {
						toast.error(readyResult.error ?? 'Error marcando la orden como lista');
						return;
					}
					toast.success('Borrador guardado y marcado como listo');
				} else {
					toast.success('Borrador guardado');
				}

				void goto(resolve(`/purchases/${purchaseOrderId}`));
				return;
			}

			const result = await createPurchaseOrderCmd({
				supplierId,
				documentType,
				invoiceNumber: invoiceNumber || undefined,
				deliveryNoteNumber: deliveryNoteNumber || undefined,
				orderDate,
				bcvRate,
				notes,
				items: buildItemsPayload()
			});

			if (result.success) {
				toast.success('Orden de compra creada exitosamente');
				void goto(resolve(`/purchases/${result.purchaseOrder.id}`));
				return;
			}

			toast.error(result.error ?? 'Error creando la orden de compra');
		} catch (error) {
			console.error(error);
			toast.error(
				getErrorMessage(
					error,
					isEdit ? 'Error guardando borrador' : 'Error creando orden de compra'
				)
			);
		} finally {
			savingAction = null;
			pendingMarkReady = false;
		}
	}
</script>

<div class="space-y-6 p-6">
	<PageHeader
		title={isEdit ? 'Editar Orden de Compra' : 'Crear Orden de Compra'}
		backLabel={isEdit ? 'Volver al detalle' : 'Volver a órdenes'}
		backOnClick={goBack}
	>
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
				onclick={() => handleSaveClick(false)}
				disabled={!canSave || saving}
				class="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-navy transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
			>
				<Save class="h-4 w-4" />
				{savingAction === 'draft'
					? 'Guardando...'
					: isEdit
						? 'Guardar cambios'
						: 'Guardar orden (borrador)'}
			</button>
			{#if isEdit}
				<button
					type="button"
					onclick={() => handleSaveClick(true)}
					disabled={!canSave || saving}
					class="inline-flex items-center gap-2 rounded-xl bg-success-container px-5 py-2.5 text-sm font-bold text-on-success-container transition-colors hover:bg-success-container/80 disabled:cursor-not-allowed disabled:opacity-60"
				>
					<CheckCircle2 class="h-4 w-4" />
					{savingAction === 'ready' ? 'Guardando...' : 'Guardar y marcar listo'}
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
		<div
			class="inline-flex items-center gap-2 self-start rounded-full bg-surface-container-high px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
		>
			{isEdit ? 'Editar devuelve el borrador a preparación' : 'Se guarda primero como borrador'}
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
