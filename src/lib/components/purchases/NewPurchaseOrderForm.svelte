<script lang="ts">
	import { AlertTriangle, Save, X } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { nowUTC, toISODate } from '$lib/dates';
	import { ConfirmModal, PageHeader } from '$lib/components/ui';
	import {
		createPurchaseOrderCmd,
		savePurchaseOrderDraftCmd
	} from '$lib/remote/purchaseOrders.remote';
	import {
		PurchaseDiscountType,
		PurchaseOrderItemType,
		PurchaseDocumentType
	} from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import PurchaseOrderDocumentPanel from './PurchaseOrderDocumentPanel.svelte';
	import PurchaseOrderItemsPanel from './PurchaseOrderItemsPanel.svelte';
	import PurchaseOrderSummaryPanel from './PurchaseOrderSummaryPanel.svelte';
	import PurchaseOrderDiscountPanel from './PurchaseOrderDiscountPanel.svelte';
	import {
		calculatePurchaseOrderSummary,
		canPersistPurchaseOrderDraft,
		getDraftItemZeroValueFields,
		getPurchaseOrderReviewStatus,
		type PurchaseOrderDiscountInput,
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

	type UnreviewedWarningLine = {
		id: string;
		title: string;
		quantity: number;
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
	let discountType = $state<PurchaseDiscountType>(
		initialValues?.discount?.type ?? PurchaseDiscountType.NONE
	);
	let discountValue = $state<number>(initialValues?.discount?.value ?? 0);
	let discountNotes = $state(initialValues?.discountNotes ?? '');
	let savingAction = $state<'draft' | null>(null);
	let showDraftWarningModal = $state(false);
	let items = $state<PurchaseOrderDraftItem[]>(initialValues?.items ?? []);

	const discount = $derived<PurchaseOrderDiscountInput>({
		type: discountType,
		value: discountType === PurchaseDiscountType.NONE ? 0 : Number(discountValue || 0)
	});

	const summary = $derived(calculatePurchaseOrderSummary(items, discount));
	const supplierLocked = $derived(items.length > 0);
	const isEdit = $derived(mode === 'edit');
	const saving = $derived(savingAction !== null);
	const reviewStatus = $derived(getPurchaseOrderReviewStatus(items));
	const unreviewedWarningLines = $derived(
		items
			.filter((item) => !item.isReviewed)
			.map(
				(item): UnreviewedWarningLine => ({
					id: item.id,
					title: getDraftItemTitle(item),
					quantity: Number(item.quantity || 0)
				})
			)
	);
	const zeroValueWarningLines = $derived(
		items
			.map((item) => buildZeroValueWarningLine(item))
			.filter((line): line is ZeroValueWarningLine => line !== null)
	);
	const hasDraftWarnings = $derived(
		unreviewedWarningLines.length > 0 || zeroValueWarningLines.length > 0
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

	function handleSaveClick() {
		if (!canSave || saving) return;

		if (hasDraftWarnings) {
			showDraftWarningModal = true;
			return;
		}

		void savePurchaseOrder();
	}

	function handleDraftWarningConfirm() {
		showDraftWarningModal = false;
		void savePurchaseOrder();
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

	async function savePurchaseOrder() {
		if (!canSave || saving) return;
		savingAction = 'draft';

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
					discount: {
						type: discount.type,
						value: discount.value,
						notes: discountNotes ? discountNotes : undefined
					},
					items: buildItemsPayload()
				});

				if (!result.success) {
					toast.error(result.error ?? 'Error guardando el borrador');
					return;
				}

				toast.success('Borrador guardado');

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
				discount: {
					type: discount.type,
					value: discount.value,
					notes: discountNotes ? discountNotes : undefined
				},
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
				onclick={handleSaveClick}
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
		{/snippet}
	</PageHeader>

	<div class="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
		<div
			class="inline-flex items-center gap-2 self-start rounded-full bg-surface-container-high px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
		>
			{isEdit ? 'Los cambios se guardan como borrador' : 'Se guarda primero como borrador'}
		</div>
		{#if items.length > 0}
			<div
				class="inline-flex items-center gap-2 self-start rounded-full bg-surface-container-high px-4 py-2 text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
			>
				{reviewStatus.reviewedCount} / {reviewStatus.totalCount} líneas marcadas
			</div>
		{/if}
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

		<PurchaseOrderDiscountPanel bind:discountType bind:discountValue bind:discountNotes />

		<PurchaseOrderSummaryPanel {summary} {bcvRate} {discount} />
	</div>
</div>

<ConfirmModal
	bind:open={showDraftWarningModal}
	title="Advertencias del borrador"
	size="lg"
	confirmLabel="Guardar borrador"
	cancelLabel="Revisar líneas"
	confirmColor="yellow"
	loading={saving}
	onConfirm={handleDraftWarningConfirm}
	onCancel={() => (showDraftWarningModal = false)}
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
			<p>Puedes guardar el borrador, pero hay líneas que conviene revisar antes de continuar.</p>

			{#if unreviewedWarningLines.length > 0}
				<div class="rounded-lg border border-warning/25 bg-warning-container/25 p-3">
					<div class="flex items-center justify-between gap-3">
						<p class="text-xs font-bold tracking-[0.14em] text-on-warning-container uppercase">
							Líneas sin check
						</p>
						<span class="font-mono text-xs font-semibold tabular-nums">
							{reviewStatus.pendingCount} pendiente(s)
						</span>
					</div>
					<div class="mt-3 max-h-36 space-y-2 overflow-y-auto pr-1">
						{#each unreviewedWarningLines as line (line.id)}
							<div
								class="flex items-center justify-between gap-3 rounded-md bg-surface-container-lowest px-2 py-1.5 text-xs"
							>
								<span class="truncate font-mono font-semibold text-brand-navy">{line.title}</span>
								<span class="shrink-0 text-on-surface-variant">Cant. {line.quantity}</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if zeroValueWarningLines.length > 0}
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
			{/if}
		</div>
	{/snippet}
</ConfirmModal>
