<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { toast } from 'svelte-sonner';
	import { untrack } from 'svelte';
	import { nowUTC, toISODate } from '$lib/dates';
	import { WizardHeader } from '$lib/components/ui';
	import {
		createPurchaseOrderCmd,
		savePurchaseOrderDraftCmd
	} from '$lib/remote/purchaseOrders.remote';
	import {
		PurchaseDiscountType,
		PurchaseDocumentType,
		PurchasePaymentTerms,
		PurchaseSourceCurrency
	} from '$lib/shared/enums';
	import { getErrorMessage } from '$lib/utils';
	import PurchaseOrderStep2 from './step2/PurchaseOrderStep2.svelte';
	import PurchaseStep1Section from './review/PurchaseStep1Section.svelte';
	import PurchaseReviewItems from './review/PurchaseReviewItems.svelte';
	import PurchaseReviewSummary from './review/PurchaseReviewSummary.svelte';
	import PurchaseWizardNav from './review/PurchaseWizardNav.svelte';
	import PurchaseOrderModals from './review/PurchaseOrderModals.svelte';
	import {
		type PurchaseOrderDraftInitialValues,
		type PurchaseOrderDraftItem
	} from './purchaseOrderDraft';
	import {
		buildPurchaseOrderPayload,
		canSavePurchaseOrder,
		hasDraftWarnings as hasDraftWarningsFor,
		isStepValid
	} from './review/purchaseReview';
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

	interface Props {
		suppliers: SupplierOption[];
		defaultTaxRate?: number;
		mode?: 'create' | 'edit';
		purchaseOrderId?: string;
		initialDraft?: PurchaseOrderDraftInitialValues;
	}

	let {
		suppliers,
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
			untrack(
				() =>
					SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ??
					'USD_BCV'
			)
	);
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
	let currentStep = $state(1);

	const saving = $derived(savingAction !== null);

	const stepValid = $derived(
		isStepValid(currentStep, {
			supplierId,
			orderDate,
			bcvRate,
			notes,
			settlementCurrency,
			documentType,
			invoiceNumber,
			deliveryNoteNumber,
			paymentTerms,
			creditDueDate,
			discountType,
			discountValue,
			sourceCurrency,
			sourceRateToVes,
			items
		})
	);

	const isEdit = $derived(mode === 'edit');
	const hasDraftWarnings = $derived(hasDraftWarningsFor(items));

	let showDocumentTypeConfirm = $state(false);
	let docTypeGuard = false;

	let showSupplierConfirm = $state(false);
	let supplierGuard = false;
	let prevSupplierId = $state(untrack(() => supplierId));
	let prevDocumentType = $state(untrack(() => documentType));

	$effect(() => {
		if (supplierGuard) {
			supplierGuard = false;
			prevSupplierId = supplierId;
			return;
		}
		if (items.length > 0 && supplierId !== prevSupplierId && supplierId !== '') {
			showSupplierConfirm = true;
		} else {
			prevSupplierId = supplierId;
		}
	});

	$effect(() => {
		if (docTypeGuard) {
			docTypeGuard = false;
			prevDocumentType = documentType;
			return;
		}
		if (items.length > 0 && documentType !== prevDocumentType) {
			showDocumentTypeConfirm = true;
		} else {
			prevDocumentType = documentType;
		}
	});

	const canSave = $derived(
		canSavePurchaseOrder({
			header: { supplierId, orderDate, bcvRate, notes, sourceCurrency, sourceRateToVes },
			items,
			terms: {
				paymentTerms,
				creditDueDate,
				earlyPaymentDiscountPercent,
				earlyPaymentDiscountDeadline
			}
		})
	);

	$effect(() => {
		const currentBcvRate = Number(bcvRate || 0);
		const currentAltRate = Number(sourceRateToVes || 0);
		const isAlt = sourceCurrency !== PurchaseSourceCurrency.USD;
		if (!isAlt || currentBcvRate <= 0) return;
		if (sourceCurrencyRequiresRateToVes(sourceCurrency) && currentAltRate <= 0) return;

		untrack(() => {
			for (const item of items) {
				if (
					item.unitPurchasePriceAlt === undefined ||
					item.unitPurchasePriceAlt === null ||
					Number(item.unitPurchasePriceAlt) <= 0
				) {
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

	let settlementManuallyChanged = $state(false);
	const settlementCurrencyConflict = $derived(
		settlementManuallyChanged &&
			settlementCurrency !==
				(SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ??
					'USD_BCV')
	);

	$effect(() => {
		if (!settlementManuallyChanged) {
			settlementCurrency =
				SOURCE_TO_CURRENCY_CODE[sourceCurrency as keyof typeof SOURCE_TO_CURRENCY_CODE] ??
				'USD_BCV';
		}
	});

	function cancelDocumentTypeChange() {
		docTypeGuard = true;
		documentType = prevDocumentType;
		showDocumentTypeConfirm = false;
	}

	function confirmDocumentTypeChange(clearItems: boolean) {
		if (clearItems) items = [];
		prevDocumentType = documentType;
		showDocumentTypeConfirm = false;
	}

	function cancelSupplierChange() {
		supplierGuard = true;
		supplierId = prevSupplierId;
		showSupplierConfirm = false;
	}

	function confirmSupplierChange() {
		items = [];
		prevSupplierId = supplierId;
		showSupplierConfirm = false;
	}

	function handleSaveClick() {
		if (!canSave || saving) return;

		if (hasDraftWarnings) {
			showDraftWarningModal = true;
			return;
		}

		void savePurchaseOrder();
	}

	function handleBack() {
		if (currentStep > 1) currentStep--;
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

	function buildPayload() {
		return buildPurchaseOrderPayload({
			supplierId,
			documentType,
			invoiceNumber,
			deliveryNoteNumber,
			orderDate,
			bcvRate,
			sourceCurrency,
			sourceRateToVes,
			settlementCurrency,
			paymentTerms,
			creditDueDate,
			earlyPaymentDiscountPercent,
			earlyPaymentDiscountDeadline,
			notes,
			discount: {
				type: discountType,
				value: discountType === PurchaseDiscountType.NONE ? 0 : Number(discountValue || 0)
			},
			discountNotes,
			items
		});
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
					...buildPayload()
				});

				if (!result.success) {
					toast.error(result.error ?? 'Error guardando el borrador');
					return;
				}

				toast.success('Borrador guardado');

				void goto(resolve(`/purchases/${purchaseOrderId}`));
				return;
			}

			const result = await createPurchaseOrderCmd(buildPayload());

			if (result.success) {
				toast.success('Orden de compra creada exitosamente');
				void goto(resolve(`/purchases/${result.purchaseOrder.id}`));
				return;
			}

			toast.error(result.error ?? 'Error creando la orden de compra');
		} catch (error) {
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

<div class="space-y-2 p-4">
	<WizardHeader
		steps={[
			{ num: 1, label: 'Información' },
			{ num: 2, label: 'Artículos' },
			{ num: 3, label: 'Revisar' }
		]}
		{currentStep}
		canNavigateToStep={(stepNum) => stepNum <= currentStep || stepValid}
		onStepSelect={(stepNum) => {
			currentStep = stepNum;
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

	{#if isEdit}
		<p class="text-xs text-on-surface-variant">Los cambios se guardan como borrador</p>
	{/if}

	{#if currentStep === 1}
		<PurchaseStep1Section
			{suppliers}
			bind:supplierId
			supplierLocked={items.length > 0}
			bind:documentType
			bind:orderDate
			bind:invoiceNumber
			bind:deliveryNoteNumber
			bind:notes
			{paymentTerms}
			bind:creditDueDate
			bind:earlyPaymentDiscountPercent
			bind:earlyPaymentDiscountDeadline
			bind:sourceCurrency
			bind:bcvRate
			bind:sourceRateToVes
			bind:settlementCurrency
			bind:settlementManuallyChanged
			bind:discountType
			bind:discountValue
			bind:discountNotes
			{settlementCurrencyConflict}
			onPaymentTermsChange={(val) => (paymentTerms = val)}
			onSourceCurrencyChange={(val) => requestPricingModeChange(val)}
		/>
	{:else if currentStep === 2}
		<PurchaseOrderStep2
			bind:items
			{supplierId}
			supplierName={suppliers.find((s) => s.id === supplierId)?.name ?? '—'}
			{documentType}
			{sourceCurrency}
			{settlementCurrency}
			{sourceRateToVes}
			bcvUsdRate={bcvRate}
			{defaultTaxRate}
		/>
	{:else if currentStep === 3}
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_20rem]">
			<PurchaseReviewItems {items} {sourceCurrency} />
			<PurchaseReviewSummary
				{items}
				supplierName={suppliers.find((s) => s.id === supplierId)?.name ?? '—'}
				{documentType}
				documentNumber={documentType === PurchaseDocumentType.INVOICE
					? invoiceNumber
					: deliveryNoteNumber}
				{orderDate}
				{bcvRate}
				{sourceCurrency}
				{discountType}
				{discountValue}
			/>
		</div>
	{/if}

	<PurchaseWizardNav
		{currentStep}
		canBack={currentStep > 1}
		canNext={currentStep < 3 && stepValid && !saving}
		{canSave}
		{saving}
		{isEdit}
		onBack={handleBack}
		onGoBack={() => {
			if (isEdit && purchaseOrderId) {
				void goto(resolve(`/purchases/${purchaseOrderId}`));
				return;
			}
			void goto(resolve('/purchases'));
		}}
		onNext={() => {
			if (currentStep < 3 && stepValid && !saving) currentStep++;
		}}
		onSave={handleSaveClick}
	/>

	<PurchaseOrderModals
		bind:showDraftWarningModal
		bind:showPricingModeConfirmModal
		bind:showDocumentTypeConfirm
		bind:showSupplierConfirm
		{saving}
		{items}
		onDraftWarningConfirm={() => {
			showDraftWarningModal = false;
			void savePurchaseOrder();
		}}
		onDraftWarningCancel={() => (showDraftWarningModal = false)}
		onPricingModeConfirm={confirmPricingModeChange}
		onPricingModeCancel={cancelPricingModeChange}
		onDocumentTypeConfirm={confirmDocumentTypeChange}
		onDocumentTypeCancel={cancelDocumentTypeChange}
		onSupplierConfirm={confirmSupplierChange}
		onSupplierCancel={cancelSupplierChange}
	/>
</div>
