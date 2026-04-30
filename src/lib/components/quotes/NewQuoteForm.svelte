<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createNewQuote } from '$lib/remote/quotes.remote';
	import { getLatestCustomerPrescription } from '$lib/remote/prescriptions.remote';
	import { getErrorMessage, dateToISODateString } from '$lib/utils';
	import { nowUTC } from '$lib/dates';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import { LensType } from '$lib/shared/enums/lensTypes';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { PrescriptionValues } from '$lib/components/sales/PrescriptionInput.svelte';
	import type { Customer, Prescription, Supplier } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import { WizardHeader } from '$lib/components/ui';
	import {
		buildStep2PrescriptionConfirmation,
		getRequiredEyes,
		validatePrescriptionFields,
		hasPrescriptionErrors
	} from '$lib/components/sales/saleItemHelpers';
	import { buildQuoteItemsFromWizard } from '$lib/components/sales/wizardSubmission';
	import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
	import SaleStep1Info from '$lib/components/sales/SaleStep1Info.svelte';
	import SaleStep2Items from '$lib/components/sales/SaleStep2Items.svelte';
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
			console.error('Error fetching prescription:', e);
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
	// SHARED PRESCRIPTION STATE
	// ============================================================================

	let prescriptionValues = $state<PrescriptionValues>({
		odSphere: '',
		odCylinder: '',
		odAxis: '',
		odAddition: '',
		oiSphere: '',
		oiCylinder: '',
		oiAxis: '',
		oiAddition: '',
		lensType: LensType.MONOFOCAL,
		doctorName: ''
	});

	// ============================================================================
	// ITEMS STATE
	// ============================================================================

	let items = $state<SaleItemRow[]>([]);

	const step2PrescriptionConfirmation = $derived(
		buildStep2PrescriptionConfirmation(items, lensItems, prescriptionValues)
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
				// lens
				return (
					(i.lensPair?.catalogItemId ?? '') !== '' &&
					(i.lensPair!.od.enabled || i.lensPair!.oi.enabled) &&
					i.unitPrice >= 0
				);
			})
	);

	const requiredEyes = $derived(getRequiredEyes(items));

	const rxErrors = $derived(
		validatePrescriptionFields(prescriptionValues, requiredEyes.needsOd, requiredEyes.needsOi)
	);

	const hasInvalidPrescription = $derived(hasPrescriptionErrors(rxErrors));

	const step2Valid = $derived(itemsValid && !hasInvalidPrescription);

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
			console.error(e);
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
			entityPanelLabel="Detalles del presupuesto"
			entityNumberLabel="Número de presupuesto"
			entityNumberValue={`P-${String(nextQuoteNumber ?? 0).padStart(4, '0')}`}
			primaryDateLabel="Fecha del presupuesto"
			primaryDateHelp="Define la fecha base del presupuesto para su seguimiento comercial."
			secondaryDateLabel="Válido hasta"
			customerHint="Puedes asociar un cliente ahora o continuar sin cliente y asignarlo después, antes de convertir el presupuesto en venta."
			stepTitle="Prepara la información base del presupuesto"
			stepDescription="Usa la misma búsqueda y registro inline de ventas para asociar un cliente, definir vigencia y dejar contexto comercial antes de cargar productos."
			notesLabel="Nota del presupuesto"
			notesDescription="Deja observaciones comerciales, condiciones de validez o contexto útil para quien convierta este presupuesto en venta."
			notesPlaceholder="Ej: precio sujeto a cambio, vigencia limitada, observaciones del cliente..."
			notesRows={4}
			workflowName="presupuesto"
			helperDefaultCopy="Busca por cédula o RIF para reutilizar un cliente existente. Si aún no existe, puedes registrarlo inline o dejar el presupuesto sin cliente y asignarlo más adelante."
			creatingCardValue="Cliente para presupuesto"
			creatingGuidePoints={[
				'Registra datos reales para que luego la conversión a venta no requiera correcciones manuales.',
				'Si todavía no tienes el cliente confirmado, puedes continuar y asociarlo antes de convertir el presupuesto.'
			]}
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
			bind:prescriptionValues
			{customerPrescription}
			{selectedCustomer}
			{newCustomer}
			{products}
			{lensItems}
			nextOrderNumber={nextQuoteNumber}
			entityNumberLabel="Presupuesto #"
			customerFallbackName="Presupuesto sin cliente"
			customerFallbackDocument="Cliente opcional"
			newCustomerContextLabel="Cliente nuevo para este presupuesto"
			selectedCustomerContextLabel="Cliente asociado al presupuesto"
			noCustomerContextLabel="Presupuesto sin cliente"
			itemsSectionTitle="Artículos del presupuesto"
			prescriptionSectionTitle="Parámetros ópticos del presupuesto"
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
			{quoteDate}
			bind:discount
			bind:discountType
			{notes}
			{validUntil}
			{nextQuoteNumber}
			{defaultTaxRate}
			{products}
			{lensItems}
			{submitting}
			{canSubmit}
			onprev={prevStep}
			onsubmit={handleSubmit}
		/>
	</div>

	<PrescriptionValidationModal
		bind:open={showPrescriptionValidationModal}
		confirmation={step2PrescriptionConfirmation}
		workflowLabel="presupuesto"
		onCancel={handlePrescriptionValidationCancel}
		onConfirm={handlePrescriptionValidationConfirm}
	/>
</div>
