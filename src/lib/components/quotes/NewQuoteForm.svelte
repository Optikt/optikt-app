<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createNewQuote } from '$lib/remote/quotes.remote';
	import { getLatestCustomerPrescription } from '$lib/remote/prescriptions.remote';
	import { getErrorMessage, dateToISODateString, logger } from '$lib/utils';
	import { nowUTC } from '$lib/dates';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { Customer, Prescription, Supplier } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import type { IncludedAccessoryMap } from '$lib/components/sales/includedAccessories';
	import { setContext } from 'svelte';
	import { WizardHeader } from '$lib/components/ui';
	import { CATALOG_KEY } from '$lib/components/sales/wizardContext';
	import { buildStep2PrescriptionConfirmation } from '$lib/components/sales/saleItemHelpers';
	import { buildQuoteItemsFromWizard } from '$lib/components/sales/wizardSubmission';
	import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
	import SaleStep1Info from '$lib/components/sales/step1/SaleStep1Info.svelte';
	import SaleStep2Items from '$lib/components/sales/step2/SaleStep2Items.svelte';
	import PrescriptionValidationModal from '$lib/components/sales/PrescriptionValidationModal.svelte';
	import QuoteStep3Summary from './QuoteStep3Summary.svelte';

	interface Props {
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		suppliers: Supplier[];
		nextQuoteNumber?: number;
		defaultTaxRate?: number;
	}

	let {
		products,
		lensItems,
		suppliers: _suppliers,
		nextQuoteNumber,
		defaultTaxRate
	}: Props = $props();

	setContext(CATALOG_KEY, {
		get products() {
			return products;
		},
		get lensItems() {
			return lensItems;
		}
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
	let submitting = $state(false);

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

	const step2PrescriptionConfirmation = $derived(
		buildStep2PrescriptionConfirmation(items, lensItems)
	);

	// ============================================================================
	// VALIDATION
	// ============================================================================

	// Step 1: always valid (customer optional for quotes)

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
					i.unitPrice >= 0
				);
			})
	);

	const step2Valid = $derived(itemsValid);

	const canSubmit = $derived(step2Valid && !submitting);

	// ============================================================================
	// STEP NAVIGATION HELPERS
	// ============================================================================

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
				quoteDate: dateToISODateString(quoteDate),
				discount,
				discountType,
				snapshotTaxRate,
				validUntil: validUntil || undefined,
				notes: notes || undefined,
				items: quoteItems
			});

			if (!result.success) {
				toast.error(result.error ?? 'Error creando presupuesto');
				return;
			}

			toast.success('Presupuesto creado exitosamente');
			goto(resolve(`/quotes/${result.quote.id}`));
		} catch (e) {
			toast.error(getErrorMessage(e, 'Error creando presupuesto'));
		} finally {
			submitting = false;
		}
	}
</script>

<div class="w-full">
	<WizardHeader
		title="Nuevo Presupuesto"
		steps={STEPS}
		{currentStep}
		{canNavigateToStep}
		onStepSelect={(step) => goToStep(step as WizardStep)}
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
			entityNumberValue={`P-${String(nextQuoteNumber ?? 0).padStart(4, '0')}`}
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

	<!-- Step 3: Resumen -->
	<div class:hidden={currentStep !== 3}>
		<QuoteStep3Summary
			{items}
			{selectedCustomer}
			{newCustomer}
			bind:discount
			bind:discountType
			{notes}
			{defaultTaxRate}
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
