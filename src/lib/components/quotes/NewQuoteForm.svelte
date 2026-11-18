<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { createNewQuote } from '$lib/remote/quotes/commands.remote';
	import { getLatestCustomerPrescription } from '$lib/remote/prescriptions.remote';
	import { getErrorMessage, dateToISODateString, logger, replaceUrlSearch } from '$lib/utils';
	import { nowUTC, fromISODate, toISODate } from '$lib/dates';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses/catalog';
	import type { Customer, Prescription, Supplier } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import type { IncludedAccessoryMap } from '$lib/components/sales/includedAccessories';
	import { setContext, untrack, type Snippet } from 'svelte';
	import WizardHeader from '$lib/components/ui/WizardHeader.svelte';
	import { CATALOG_KEY } from '$lib/components/sales/wizardContext';
	import {
		buildStep2PrescriptionConfirmation,
		getAvailableProductStock,
		hasLensPrescriptionErrors,
		isItemDiscountValid
	} from '$lib/components/sales/saleItemHelpers';
	import { buildQuoteItemsFromWizard } from '$lib/components/sales/wizardSubmission';
	import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
	import SaleStep1Info from '$lib/components/sales/step1/SaleStep1Info.svelte';
	import SaleStep2Items from '$lib/components/sales/step2/SaleStep2Items.svelte';
	import SaleStep3Summary from '$lib/components/sales/step3/SaleStep3Summary.svelte';
	import PrescriptionValidationModal from '$lib/components/sales/PrescriptionValidationModal.svelte';
	import { Copy } from '@lucide/svelte';
	import { quoteToWizardDraft } from './duplicate/quoteToWizardDraft';
	import { formatQuoteNumber } from './list/quoteListDisplay';
	import type { QuoteWithRelations, QuoteItemWithDetails } from '$lib/server/db/queries/quotes';

	interface Props {
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		suppliers: Supplier[];
		nextQuoteNumber?: number;
		defaultTaxRate?: number;
		/** Duplicar (D7): `?from=<id>` — el loader entrega el detalle del origen. */
		fromQuote?: { quote: QuoteWithRelations; items: QuoteItemWithDetails[] } | null;
		breadcrumbs?: Snippet;
	}

	let {
		products,
		lensItems,
		suppliers: _suppliers,
		nextQuoteNumber,
		defaultTaxRate,
		fromQuote = null,
		breadcrumbs
	}: Props = $props();

	setContext(CATALOG_KEY, {
		getProducts: () => products,
		getLensItems: () => lensItems
	});

	// ============================================================================
	// WIZARD STATE
	// ============================================================================

	type WizardStep = 1 | 2 | 3;
	let currentStep = $state<WizardStep>(1);
	let showPrescriptionValidationModal = $state(false);

	const STEPS = [
		{ num: 1 as const, label: 'Información' },
		{ num: 2 as const, label: 'Productos y Lentes' },
		{ num: 3 as const, label: 'Resumen' }
	];

	function goToStep(step: WizardStep) {
		if (step === 3 && currentStep !== 3) {
			if (!step2Valid) return;
			showPrescriptionValidationModal = true;
			return;
		}

		currentStep = step;
	}

	function nextStep() {
		if (currentStep === 2) {
			if (!step2Valid) return;
			showPrescriptionValidationModal = true;
			return;
		}
		if (currentStep < 3) {
			currentStep = (currentStep + 1) as WizardStep;
		}
	}

	function prevStep() {
		if (currentStep > 1) currentStep = (currentStep - 1) as WizardStep;
	}

	function canNavigateToStep(stepNum: number): boolean {
		return stepNum === 1 || stepNum === 2 || (stepNum === 3 && step2Valid);
	}

	function goToQuotes() {
		goto(resolve('/quotes'));
	}

	function handlePrescriptionValidationCancel() {
		showPrescriptionValidationModal = false;
	}

	function handlePrescriptionValidationConfirm() {
		showPrescriptionValidationModal = false;
		currentStep = 3;
	}

	// ============================================================================
	// FORM STATE
	// ============================================================================

	let customerId = $state('');
	let selectedCustomer = $state<Customer | null>(null);
	let newCustomer = $state<NewCustomerData | null>(null);
	let quoteDate = $state<Date>(nowUTC());
	let discount = $state(0);
	let discountType = $state<DiscountTypeEnum>(DiscountType.FIXED);
	let notes = $state('');
	let validUntil = $state('');
	let isCashea = $state(false);
	let submitting = $state(false);

	// Duplicar (D7): precarga ítems/descuento/Cashea/notas; resetea cliente,
	// fecha (hoy) y validez. sourceQuoteId se envía en el create.
	// (después de declarar items/includedAccessoryMap — ver bloque abajo)
	const duplicateItemCount = $derived(
		fromQuote ? fromQuote.items.filter((i) => i.itemType !== 'TREATMENT').length : 0
	);

	// Fecha editable del WizardHeader → quoteDate (mismo patrón que ventas)
	// snapshot inicial del seed (recalculado por los effects de abajo).
	// svelte-ignore state_referenced_locally
	let orderDateIso = $state(dateToISODateString(quoteDate));

	$effect(() => {
		if (/^\d{4}-\d{2}-\d{2}$/.test(orderDateIso)) {
			const parsed = fromISODate(orderDateIso);
			if (parsed && parsed.getTime() !== quoteDate.getTime()) {
				quoteDate = parsed;
			}
		}
	});
	$effect(() => {
		if (quoteDate instanceof Date && !isNaN(quoteDate.getTime())) {
			const iso = dateToISODateString(quoteDate);
			if (iso !== orderDateIso) {
				orderDateIso = iso;
			}
		}
	});

	// ============================================================================
	// CUSTOMER PRESCRIPTION STATE
	// ============================================================================

	let customerPrescription = $state<Prescription | null>(null);

	async function fetchCustomerPrescription(custId: string) {
		if (!custId) {
			customerPrescription = null;
			return;
		}
		try {
			customerPrescription = await getLatestCustomerPrescription({ customerId: custId });
		} catch (e) {
			logger.error('Error obteniendo fórmula del cliente', e);
			customerPrescription = null;
		}
	}

	$effect(() => {
		const id = customerId || selectedCustomer?.id;
		if (id) {
			fetchCustomerPrescription(id);
		} else {
			customerPrescription = null;
		}
	});

	// ============================================================================
	// ITEMS STATE
	// ============================================================================

	let items = $state<SaleItemRow[]>([]);
	let includedAccessoryMap = $state<IncludedAccessoryMap>({});
	let sourceQuoteId = $state<string | null>(null);

	// Duplicar (D7): precarga ítems/descuento/Cashea/notas; resetea cliente,
	// fecha (hoy) y validez (sourceQuoteId se envía en el create).
	{
		const seed = untrack(() => fromQuote);
		if (seed) {
			const draft = quoteToWizardDraft(seed);
			items = draft.items;
			includedAccessoryMap = {};
			discount = draft.discount;
			discountType = draft.discountType as DiscountTypeEnum;
			notes = draft.notes;
			isCashea = draft.isCashea;
			sourceQuoteId = seed.quote.id;
			quoteDate = nowUTC();
		}
	}

	function startEmpty() {
		items = [];
		includedAccessoryMap = {};
		customerId = '';
		selectedCustomer = null;
		newCustomer = null;
		discount = 0;
		discountType = DiscountType.FIXED;
		notes = '';
		isCashea = false;
		sourceQuoteId = null;
		quoteDate = nowUTC();
		validUntil = '';
		replaceUrlSearch(page.url, (params) => params.delete('from'));
	}

	const step2PrescriptionConfirmation = $derived(
		buildStep2PrescriptionConfirmation(items, lensItems)
	);

	// ============================================================================
	// VALIDATION
	// ============================================================================

	// Step 1: siempre válido (el cliente es opcional en presupuestos)

	const itemsValid = $derived(
		items.length > 0 &&
			items.every((i) => {
				if (i.kind === 'product') {
					return i.productId !== '' && i.quantity > 0 && i.unitPrice >= 0;
				}
				if (i.kind === 'free') {
					return (
						i.freeItem !== null &&
						(i.freeItem.category?.length ?? 0) > 0 &&
						(i.freeItem.description?.length ?? 0) >= 3 &&
						i.unitPrice > 0
					);
				}
				if (i.kind === 'treatment') {
					return i.supplierTreatmentId !== '' && i.unitPrice >= 0;
				}
				// lens
				return (
					(i.lensPair?.catalogItemId ?? '') !== '' &&
					(i.lensPair!.od.enabled || i.lensPair!.oi.enabled) &&
					i.unitPrice >= 0 &&
					!hasLensPrescriptionErrors(i)
				);
			})
	);

	const hasOutOfStockItem = $derived(
		items.some((i) => {
			if (i.kind === 'product' && i.productId) {
				const availableForItem = getAvailableProductStock(items, products, i.productId, i.id);
				if (availableForItem === null) return false;

				return availableForItem <= 0 || i.quantity > availableForItem;
			}
			return false;
		})
	);

	const step2Valid = $derived(itemsValid && !hasOutOfStockItem);

	const hasInvalidItemDiscount = $derived(items.some((item) => !isItemDiscountValid(item)));

	const canSubmit = $derived(step2Valid && !hasInvalidItemDiscount && !submitting);

	// ============================================================================
	// SUBMIT
	// ============================================================================

	async function handleSubmit() {
		if (!canSubmit) return;
		submitting = true;

		try {
			const quoteItems = buildQuoteItemsFromWizard(items, products, lensItems);
			const snapshotTaxRate = defaultTaxRate ?? DEFAULT_TAX_RATE;

			const result = await createNewQuote({
				customerId: customerId || undefined,
				newCustomer:
					newCustomer && newCustomer.firstName && newCustomer.lastName ? newCustomer : undefined,
				quoteDate: toISODate(quoteDate),
				discount,
				discountType,
				snapshotTaxRate,
				isCashea,
				sourceQuoteId: sourceQuoteId ?? undefined,
				validUntil: validUntil || undefined,
				notes: notes || undefined,
				items: quoteItems
			});

			if (!result.success) {
				toast.error(result.error ?? 'Error creando presupuesto');
				return;
			}

			// El número real lo asigna la sequence (puede diferir del preview)
			toast.success(`Presupuesto ${formatQuoteNumber(result.quote.quoteNumber)} creado`);
			goto(resolve(`/quotes/${result.quote.id}`));
		} catch (e) {
			logger.error('Error creando presupuesto', e);
			toast.error(getErrorMessage(e, 'Error creando presupuesto'));
		} finally {
			submitting = false;
		}
	}
</script>

<div class="w-full space-y-2">
	<!-- Banner de duplicado (D7) -->
	{#if fromQuote}
		<div
			class="flex flex-wrap items-center gap-3 rounded-xl bg-info-container px-4 py-2.5 text-on-info-container"
		>
			<Copy class="h-4 w-4 shrink-0" />
			<p class="flex-1 text-[14px]">
				<b>Duplicando {formatQuoteNumber(fromQuote.quote.quoteNumber)}</b>
				· {duplicateItemCount} artículos, fórmula y descuento copiados. Elige el cliente.
			</p>
			<button
				type="button"
				onclick={startEmpty}
				class="text-[13px] font-semibold underline underline-offset-2 hover:opacity-80"
			>
				Empezar vacío
			</button>
		</div>
	{/if}

	<WizardHeader
		steps={STEPS}
		{currentStep}
		{canNavigateToStep}
		onStepSelect={(step) => goToStep(step as WizardStep)}
		orderNumber={`P-${String(nextQuoteNumber ?? 0).padStart(4, '0')}`}
		bind:orderDate={orderDateIso}
		{breadcrumbs}
	/>

	<!-- Step 1: Información -->
	<div class:hidden={currentStep !== 1}>
		<SaleStep1Info
			bind:customerId
			bind:selectedCustomer
			bind:newCustomer
			bind:saleDate={quoteDate}
			bind:secondaryDate={validUntil}
			bind:notes
			bind:isCashea
			showSecondaryDate={true}
			casheaLabel="Presupuesto con Cashea"
			casheaHint="Se aplicará a la venta al convertir"
			stepTitle="Prepara la información base del presupuesto"
			summaryLabel="Presupuesto"
			summaryValue={`P-${String(nextQuoteNumber ?? 0).padStart(4, '0')}`}
			valid={true}
			nextOrderNumber={nextQuoteNumber}
			onnext={nextStep}
		/>
	</div>

	<!-- Step 2: Productos y Lentes -->
	<div class:hidden={currentStep !== 2}>
		<SaleStep2Items
			bind:items
			bind:includedAccessoryMap
			{customerPrescription}
			{selectedCustomer}
			{newCustomer}
			customerFallbackName="Presupuesto sin cliente"
			customerFallbackDocument="Cliente opcional"
			newCustomerContextLabel="Cliente nuevo para este presupuesto"
			selectedCustomerContextLabel="Cliente asociado al presupuesto"
			noCustomerContextLabel="Presupuesto sin cliente"
			itemsSectionTitle="Artículos del presupuesto"
			onCancel={goToQuotes}
			valid={step2Valid}
			onnext={nextStep}
			onprev={prevStep}
		/>
	</div>

	<!-- Step 3: Resumen (SaleStep3Summary — QuoteStep3Summary eliminado) -->
	<div class:hidden={currentStep !== 3}>
		<SaleStep3Summary
			{items}
			{selectedCustomer}
			{newCustomer}
			bind:discount
			bind:discountType
			bind:notes
			bind:isCashea
			{defaultTaxRate}
			customerFallbackName="Presupuesto sin cliente"
			customerFallbackDocument="Cliente opcional"
			submittingStatusLabel="Creando presupuesto"
			readyStatusLabel="Listo para crear"
			pendingStatusLabel="Revisa el presupuesto"
			primaryLabel="Crear presupuesto"
			cancelLabel="Cancelar"
			onCancel={goToQuotes}
			{submitting}
			{canSubmit}
			onprev={prevStep}
			onsubmit={handleSubmit}
		/>
	</div>

	<PrescriptionValidationModal
		bind:open={showPrescriptionValidationModal}
		confirmation={step2PrescriptionConfirmation}
		onCancel={handlePrescriptionValidationCancel}
		onConfirm={handlePrescriptionValidationConfirm}
	/>
</div>
