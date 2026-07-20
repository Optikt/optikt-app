<script lang="ts">
	import { AlertTriangle, Save } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { nowUTC, toISODate } from '$lib/dates';
	import { WizardHeader, ConfirmModal } from '$lib/components/ui';
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
		canPersistPurchaseOrderDraft,
		getDraftItemZeroValueFields,
		getPurchaseOrderReviewStatus,
		type PurchaseOrderDiscountInput,
		type PurchaseOrderDraftInitialValues,
		type PurchaseOrderDraftZeroValueField,
		type PurchaseOrderDraftItem
	} from './purchaseOrderDraft';
	import {
		sourceCurrencyRequiresRateToVes,
		SOURCE_TO_CURRENCY_CODE,
		sourcePriceToUsdBcv
	} from '$lib/shared/purchaseOrderCurrencies';
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
			untrack(() =>
				mode === 'edit'
					? (SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ??
						'USD_BCV')
					: ''
			)
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
	let currentStep = $state(0);

	const saving = $derived(savingAction !== null);

	const steps = [
		{ num: 1, label: 'Documento' },
		{ num: 2, label: 'Artículos' },
		{ num: 3, label: 'Pago' },
		{ num: 4, label: 'Revisar' }
	];

	const stepValid = $derived.by(() => {
		switch (currentStep) {
			case 0:
				return (
					Boolean(supplierId) &&
					Boolean(orderDate) &&
					Number(bcvRate) > 0 &&
					String(notes ?? '').trim().length >= 6 &&
					Boolean(settlementCurrency)
				);
			case 1:
				return items.length > 0;
			case 2:
				return true;
			case 3:
				return true;
			default:
				return false;
		}
	});

	const canNext = $derived(currentStep < 3 && stepValid && !saving);
	const canBack = $derived(currentStep > 0);
	const isLastStep = $derived(currentStep === 3);

	const discount = $derived<PurchaseOrderDiscountInput>({
		type: discountType,
		value: discountType === PurchaseDiscountType.NONE ? 0 : Number(discountValue || 0)
	});

	const summary = $derived(calculatePurchaseOrderSummary(items, discount, bcvRate));
	const supplierLocked = $derived(items.length > 0);
	const isEdit = $derived(mode === 'edit');
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

				item.unitPurchasePrice = sourcePriceToUsdBcv({
					sourceCurrency,
					unitPriceAlt: item.unitPurchasePriceAlt,
					appliesIva: item.appliesIva,
					ivaRate: item.ivaRate,
					sourceRateToVes: currentAltRate,
					bcvRate: currentBcvRate
				});
			}
		});
	});

	function handlePaymentTermsChange(nextTerms: PurchasePaymentTerms) {
		paymentTerms = nextTerms;
	}

	let settlementManuallyChanged = $state(false);
	$effect(() => {
		if (!settlementManuallyChanged && settlementCurrency !== '') {
			settlementCurrency =
				SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ??
				'USD_BCV';
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

	function handleNext() {
		if (canNext) currentStep++;
	}

	function handleBack() {
		if (canBack) currentStep--;
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

	function buildPurchaseOrderPayload() {
		return {
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
		} as const;
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
					...buildPurchaseOrderPayload()
				});

				if (!result.success) {
					toast.error(result.error ?? 'Error guardando el borrador');
					return;
				}

				toast.success('Borrador guardado');

				void goto(resolve(`/purchases/${purchaseOrderId}`));
				return;
			}

			const result = await createPurchaseOrderCmd(buildPurchaseOrderPayload());

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

<div class="space-y-3 p-4">
	<WizardHeader
		subtitle={currentStep > 0 && supplierId
			? `Proveedor: ${suppliers.find((s) => s.id === supplierId)?.name ?? '—'} · Moneda: ${settlementCurrency || sourceCurrency} · BCV: ${bcvRate || '—'}${sourceRateToVes > 0 ? ` · ${sourceCurrency}: ${sourceRateToVes}` : ''}`
			: isEdit
				? 'Los cambios se guardan como borrador'
				: undefined}
		{steps}
		currentStep={currentStep + 1}
		canNavigateToStep={(stepNum) => stepNum - 1 < currentStep || stepValid}
		onStepSelect={(stepNum) => {
			currentStep = stepNum - 1;
		}}
	>
		{#snippet breadcrumbs()}
			<p class="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
				<a href={resolve('/purchases')} class="transition-colors hover:text-brand-blue">Compras</a>
				<span class="mx-2 text-outline">›</span>
				<span class="text-brand-navy">{isEdit ? 'Editar compra' : 'Nueva compra'}</span>
			</p>
		{/snippet}
	</WizardHeader>

	<!-- Step content -->
	{#if currentStep === 0}
		<section class="rounded-2xl bg-surface-container-low p-5 ring-1 ring-outline-variant/20">
			<h2 class="text-lg font-semibold text-brand-navy">Información de la compra</h2>
			<div class="mt-4 space-y-5">
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
					bare
				/>

				<hr class="border-outline-variant/30" />

				<div class="space-y-4">
					<div>
						<p class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
							Base de precios
						</p>
						<div class="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-surface-container-high p-1">
							{#each ACTIVE_PURCHASE_SOURCE_CURRENCIES as currency (currency)}
								<button
									type="button"
									onclick={() => requestPricingModeChange(currency)}
									class={`rounded-lg px-3 py-1.5 text-xs font-semibold tracking-[0.14em] uppercase transition-colors ${
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
					</div>

					<div class="flex flex-wrap items-center gap-x-4 gap-y-2">
						<label
							for="settlement-currency"
							class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
						>
							Moneda de obligación
						</label>
						<select
							id="settlement-currency"
							class="rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
							bind:value={settlementCurrency}
							onchange={() => (settlementManuallyChanged = true)}
						>
							<option value="" disabled>Seleccionar moneda...</option>
							<option value="USD_BCV">USD (BCV)</option>
							<option value="EUR_BCV">EUR (BCV)</option>
							<option value="USDT">USDT</option>
							<option value="USD_PAYPAL">USD PayPal</option>
							<option value="VES">Bs. (Bolívares)</option>
						</select>
						{#if settlementCurrency !== 'USD_BCV' && settlementCurrency !== 'VES'}
							<label
								for="settlement-rate"
								class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
							>
								Tasa {settlementCurrency}
							</label>
							<input
								id="settlement-rate"
								type="number"
								bind:value={settlementRateToVes}
								class="w-32 rounded-lg border border-outline-variant/30 bg-surface-container-lowest px-3 py-2 text-sm text-on-surface"
								placeholder="Bs/unidad"
							/>
						{/if}
					</div>
				</div>
			</div>
		</section>
	{:else if currentStep === 1}
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
	{:else if currentStep === 2}
		<div class="space-y-5">
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
		</div>
	{:else if currentStep === 3}
		<div class="space-y-5">
			<PurchaseOrderSummaryPanel
				{summary}
				{bcvRate}
				{discount}
				{sourceCurrency}
				{sourceRateToVes}
			/>
			<div class="rounded-2xl bg-surface-container-low p-5 ring-1 ring-outline-variant/20">
				<p class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
					Artículos incluidos
				</p>
				<ul class="mt-3 space-y-2">
					{#each items as item (item.id)}
						<li
							class="flex items-center justify-between gap-3 rounded-lg bg-surface-container-high px-3 py-2 text-sm"
						>
							<div class="min-w-0 truncate">
								<span class="font-mono font-semibold text-brand-navy"
									>{getDraftItemTitle(item)}</span
								>
								<span class="ml-2 text-on-surface-variant">×{item.quantity}</span>
							</div>
							<span class="shrink-0 font-mono text-sm tabular-nums"
								>{formatPrice(item.unitPurchasePrice)}</span
							>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	{/if}

	<!-- Navigation footer -->
	<div class="flex items-center justify-between gap-3 pt-2">
		<div>
			{#if canBack}
				<button
					type="button"
					onclick={handleBack}
					class="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
				>
					← Atrás
				</button>
			{:else}
				<button
					type="button"
					onclick={goBack}
					class="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high"
				>
					Cancelar
				</button>
			{/if}
		</div>
		<div class="flex items-center gap-2">
			{#if currentStep === 3}
				<button
					type="button"
					onclick={handleSaveClick}
					disabled={!canSave || saving}
					class="inline-flex items-center gap-2 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
				>
					<Save class="h-4 w-4" />
					{saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear orden'}
				</button>
			{:else}
				<button
					type="button"
					onclick={handleNext}
					disabled={!canNext}
					class="inline-flex items-center gap-1.5 rounded-lg bg-brand-gold px-6 py-2.5 text-sm font-bold text-brand-navy shadow-sm transition-colors hover:bg-brand-gold-dark disabled:cursor-not-allowed disabled:opacity-60"
				>
					Siguiente →
				</button>
			{/if}
		</div>
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
