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
		PurchaseDocumentType,
		PurchasePaymentTerms,
		PurchaseSourceCurrency,
		CurrencyCode,
		ACTIVE_PURCHASE_SOURCE_CURRENCIES,
		PURCHASE_SOURCE_CURRENCY_LABELS
	} from '$lib/shared/enums';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import { formatPrice, getErrorMessage } from '$lib/utils';
	import PurchaseOrderDocumentPanel from './PurchaseOrderDocumentPanel.svelte';
	import PurchaseOrderItemsPanel from './PurchaseOrderItemsPanel.svelte';
	import PurchaseOrderSummaryPanel from './PurchaseOrderSummaryPanel.svelte';
	import PurchaseOrderDiscountPanel from './PurchaseOrderDiscountPanel.svelte';
	import PurchaseOrderPaymentTermsPanel from './PurchaseOrderPaymentTermsPanel.svelte';
	import {
		calculatePurchaseOrderSummary,
		calculateUnitPurchasePriceFromVesPreTax,
		calculateUnitPurchasePriceFromEurPreTax,
		canPersistPurchaseOrderDraft,
		getDraftItemZeroValueFields,
		getPurchaseOrderReviewStatus,
		type PurchaseOrderDiscountInput,
		type PurchaseOrderDraftInitialValues,
		type PurchaseOrderDraftZeroValueField,
		type PurchaseOrderDraftItem
	} from './purchaseOrderDraft';
	import { sourceCurrencyRequiresRateToVes, SOURCE_TO_CURRENCY_CODE } from '$lib/shared/purchaseOrderCurrencies';
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
	let sourceCurrency = $state<string>(initialValues?.sourceCurrency ?? PurchaseSourceCurrency.USD);
	let sourceRateToVes = $state<number>(initialValues?.sourceRateToVes ?? 0);
	let settlementCurrency = $state<string>(
		initialValues?.settlementCurrency ??
			SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ??
			'USD_BCV'
	);
	let settlementRateToVes = $state<number>(initialValues?.settlementRateToVes ?? 0);
	let notes = $state(initialValues?.notes ?? '');
	let paymentTerms = $state<PurchasePaymentTerms>(
		initialValues?.paymentTerms ?? PurchasePaymentTerms.CONTADO
	);
	let creditDueDate = $state<string | null>(initialValues?.creditDueDate ?? null);
	let earlyPaymentDiscountPercent = $state<number | null>(
		initialValues?.earlyPaymentDiscountPercent ?? null
	);
	let earlyPaymentDiscountDeadline = $state<string | null>(
		initialValues?.earlyPaymentDiscountDeadline ?? null
	);
	let discountType = $state<PurchaseDiscountType>(
		initialValues?.discount?.type ?? PurchaseDiscountType.NONE
	);
	let discountValue = $state<number>(initialValues?.discount?.value ?? 0);
	let discountNotes = $state(initialValues?.discountNotes ?? '');
	let savingAction = $state<'draft' | null>(null);
	let showDraftWarningModal = $state(false);
	let showPricingModeConfirmModal = $state(false);
	let pendingSourceCurrency = $state<string | null>(null);
	let items = $state<PurchaseOrderDraftItem[]>(initialValues?.items ?? []);

	const discount = $derived<PurchaseOrderDiscountInput>({
		type: discountType,
		value: discountType === PurchaseDiscountType.NONE ? 0 : Number(discountValue || 0)
	});

	const summary = $derived(calculatePurchaseOrderSummary(items, discount, bcvRate));
	const supplierLocked = $derived(items.length > 0);
	const isEdit = $derived(mode === 'edit');
	const saving = $derived(savingAction !== null);
	const reviewStatus = $derived(getPurchaseOrderReviewStatus(items));
	const unreviewedWarningLines = $derived(
		items
			.filter((item) => !item.isReviewed)
			.map((item): UnreviewedWarningLine => ({
				id: item.id,
				title: getDraftItemTitle(item),
				quantity: Number(item.quantity || 0)
			}))
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
		canPersistPurchaseOrderDraft(
			{ supplierId, orderDate, bcvRate, notes, sourceCurrency, sourceRateToVes },
			items,
			{
				paymentTerms,
				creditDueDate,
				earlyPaymentDiscountPercent,
				earlyPaymentDiscountDeadline
			}
		)
	);

	$effect(() => {
		const currentBcvRate = Number(bcvRate || 0);
		const currentAltRate = Number(sourceRateToVes || 0);
		const isAlt = sourceCurrency !== PurchaseSourceCurrency.USD;
		if (!isAlt || currentBcvRate <= 0) return;
		if (sourceCurrencyRequiresRateToVes(sourceCurrency) && currentAltRate <= 0) return;

		untrack(() => {
			for (const item of items) {
				if (item.unitPurchasePriceAlt === undefined || item.unitPurchasePriceAlt === null) {
					continue;
				}

				if (sourceCurrencyRequiresRateToVes(sourceCurrency)) {
					item.unitPurchasePrice = calculateUnitPurchasePriceFromEurPreTax(
						item.unitPurchasePriceAlt,
						item.appliesIva,
						item.ivaRate,
						currentAltRate,
						currentBcvRate
					);
				} else {
					item.unitPurchasePrice = calculateUnitPurchasePriceFromVesPreTax(
						item.unitPurchasePriceAlt,
						item.appliesIva,
						item.ivaRate,
						currentBcvRate
					);
				}
			}
		});
	});

	function handlePaymentTermsChange(nextTerms: PurchasePaymentTerms) {
		paymentTerms = nextTerms;
	}

	let settlementManuallyChanged = $state(false);
	$effect(() => {
		if (!settlementManuallyChanged) {
			settlementCurrency =
				SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ?? 'USD_BCV';
		}
	});

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

	function clearItemPricing(item: PurchaseOrderDraftItem) {
		item.unitPurchasePrice = 0;
		item.unitPurchasePriceAlt = 0;
		item.isZeroPriceIntentional = false;
		item.isReviewed = false;
	}

	function requestPricingModeChange(nextValue: string) {
		if (nextValue === sourceCurrency) return;

		if (items.length === 0) {
			sourceCurrency = nextValue;
			return;
		}

		pendingSourceCurrency = nextValue;
		showPricingModeConfirmModal = true;
	}

	function confirmPricingModeChange() {
		if (pendingSourceCurrency === null) return;

		const nextValue = pendingSourceCurrency;
		showPricingModeConfirmModal = false;
		pendingSourceCurrency = null;

		untrack(() => {
			sourceCurrency = nextValue;
			for (const item of items) {
				clearItemPricing(item);
			}
		});
	}

	function cancelPricingModeChange() {
		showPricingModeConfirmModal = false;
		pendingSourceCurrency = null;
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
			unitPurchasePriceAlt:
				sourceCurrency !== PurchaseSourceCurrency.USD
					? (item.unitPurchasePriceAlt ?? 0)
					: undefined,
			unitSalePrice: item.unitSalePrice,
			isZeroPriceIntentional: item.isZeroPriceIntentional,
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
					altRate: sourceCurrencyRequiresRateToVes(sourceCurrency) ? sourceRateToVes : undefined,
					sourceCurrency,
					settlementCurrency: settlementCurrency as CurrencyCode,
					settlementRateToVes:
						settlementCurrency !== 'USD_BCV' && settlementCurrency !== 'VES'
							? settlementRateToVes
							: undefined,
					paymentTerms,
					creditDueDate,
					earlyPaymentDiscountPercent,
					earlyPaymentDiscountDeadline,
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
				altRate: sourceCurrencyRequiresRateToVes(sourceCurrency) ? sourceRateToVes : undefined,
				sourceCurrency,
				settlementCurrency: settlementCurrency as CurrencyCode,
				settlementRateToVes:
					settlementCurrency !== 'USD_BCV' && settlementCurrency !== 'VES'
						? settlementRateToVes
						: undefined,
				paymentTerms,
				creditDueDate,
				earlyPaymentDiscountPercent,
				earlyPaymentDiscountDeadline,
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
			bind:sourceRateToVes
			{sourceCurrency}
			bind:invoiceNumber
			bind:deliveryNoteNumber
			bind:notes
			{supplierLocked}
		/>

		<section class="rounded-2xl bg-surface-container-low p-5 ring-1 ring-outline-variant/20">
			<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
				<div class="space-y-1">
					<p class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
						Modo de captura
					</p>
					<h2 class="text-lg font-semibold text-brand-navy">Base de precios de la factura</h2>
					<p class="max-w-2xl text-sm text-on-surface-variant">
						{#if sourceCurrency === PurchaseSourceCurrency.VES}
							Ingresa el precio unitario sin IVA en bolívares. El sistema deriva el costo USD para
							inventario usando la tasa BCV.
						{:else if sourceCurrency === PurchaseSourceCurrency.EUR}
							Ingresa el precio unitario sin IVA en euros. El sistema convierte a USD usando la tasa
							EUR y la tasa BCV.
						{:else if sourceCurrency === PurchaseSourceCurrency.USDT}
							Ingresa el precio unitario sin IVA en USDT. El sistema convierte a USD usando la tasa
							USDT y la tasa BCV.
						{:else if sourceCurrency === PurchaseSourceCurrency.PAYPAL}
							Ingresa el precio unitario sin IVA en USD PayPal. El sistema convierte a USD usando la
							tasa PayPal y la tasa BCV.
						{:else}
							Ingresa el costo unitario en USD BCV como hasta ahora. El equivalente en Bs se calcula
							desde la tasa BCV.
						{/if}
					</p>
				</div>

				<div class="inline-flex rounded-xl bg-surface-container-high p-1">
					{#each ACTIVE_PURCHASE_SOURCE_CURRENCIES as currency (currency)}
						<button
							type="button"
							onclick={() => requestPricingModeChange(currency)}
							class={`rounded-lg px-4 py-2 text-xs font-semibold tracking-[0.14em] uppercase transition-colors ${
								sourceCurrency === currency
									? 'bg-brand-navy text-white'
									: 'text-on-surface-variant hover:text-brand-navy'
							}`}
							aria-pressed={sourceCurrency === currency}
						>
							{PURCHASE_SOURCE_CURRENCY_LABELS[currency]}
						</button>
					{/each}
				</div>

				<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
					<label class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
						Moneda de obligación
					</label>
					<select
						class="rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
						bind:value={settlementCurrency}
						onchange={() => (settlementManuallyChanged = true)}
					>
						<option value="USD_BCV">USD (BCV)</option>
						<option value="EUR_BCV">EUR (BCV)</option>
						<option value="USDT">USDT</option>
						<option value="USD_PAYPAL">USD PayPal</option>
						<option value="VES">Bs. (Bolívares)</option>
					</select>
					{#if settlementCurrency !== 'USD_BCV' && settlementCurrency !== 'VES'}
						<label class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
							Tasa {settlementCurrency}
						</label>
						<input
							type="number"
							bind:value={settlementRateToVes}
							class="w-32 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
							placeholder="Bs/unidad"
						/>
					{/if}
				</div>
			</div>
		</section>

		<PurchaseOrderItemsPanel
			bind:items
			{products}
			{lensItems}
			{supplierId}
			{documentType}
			{sourceCurrency}
			{sourceRateToVes}
			bcvUsdRate={bcvRate}
			{defaultTaxRate}
		/>

		<PurchaseOrderDiscountPanel bind:discountType bind:discountValue bind:discountNotes />

		<PurchaseOrderPaymentTermsPanel
			{paymentTerms}
			{creditDueDate}
			{earlyPaymentDiscountPercent}
			{earlyPaymentDiscountDeadline}
			totalNetAmount={summary.netTotal}
			totalNetAmountAlt={sourceCurrency !== 'USD' ? summary.netTotalAlt : undefined}
			{sourceCurrency}
			onPaymentTermsChange={handlePaymentTermsChange}
			onCreditDueDateChange={(value) => (creditDueDate = value)}
			onEarlyPaymentDiscountPercentChange={(value) => (earlyPaymentDiscountPercent = value)}
			onEarlyPaymentDiscountDeadlineChange={(value) => (earlyPaymentDiscountDeadline = value)}
		/>

		<PurchaseOrderSummaryPanel {summary} {bcvRate} {discount} {sourceCurrency} {sourceRateToVes} />
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
			<p>
				Puedes guardar el borrador, pero hay líneas que conviene revisar antes de continuar. Si un
				precio en 0 es deliberado, márcalo en la línea como 0 intencional.
			</p>

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

<ConfirmModal
	bind:open={showPricingModeConfirmModal}
	title="Cambiar modo de precios"
	message="Cambiar la base de precios limpiará los costos actuales de todas las líneas para evitar mezclar bases distintas."
	confirmLabel="Cambiar y limpiar precios"
	cancelLabel="Mantener modo actual"
	confirmColor="yellow"
	onConfirm={confirmPricingModeChange}
	onCancel={cancelPricingModeChange}
/>
