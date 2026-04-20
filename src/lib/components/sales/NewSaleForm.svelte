<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createSale } from '$lib/remote/sales.remote';
	import { getLatestCustomerPrescription } from '$lib/remote/prescriptions.remote';
	import { getErrorMessage, dateToISODateString } from '$lib/utils';
	import { isDiscountValueValid } from '$lib/utils';
	import { nowUTC } from '$lib/dates';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import { LensType } from '$lib/shared/enums/lensTypes';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { PrescriptionValues } from './PrescriptionInput.svelte';
	import type { Customer, Prescription, Supplier } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from './newSaleTypes';
	import { WizardHeader } from '$lib/components/ui';
	import {
		calculateSaleSummarySubtotal,
		getAvailableProductStock,
		getRequiredEyes,
		isItemDiscountValid,
		validatePrescriptionFields,
		hasPrescriptionErrors
	} from './saleItemHelpers';
	import { buildPrescriptionPayload, buildSaleItemsFromWizard } from './wizardSubmission';
	import SaleStep1Info from './SaleStep1Info.svelte';
	import SaleStep2Items from './SaleStep2Items.svelte';
	import SaleStep3Summary from './SaleStep3Summary.svelte';

	interface Props {
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		suppliers: Supplier[];
		nextOrderNumber?: number;
		defaultTaxRate?: number;
	}

	let { products, lensItems, suppliers: _suppliers, nextOrderNumber, defaultTaxRate }: Props = $props();

	// ============================================================================
	// WIZARD STATE
	// ============================================================================

	type WizardStep = 1 | 2 | 3;
	let currentStep = $state<WizardStep>(1);

	const STEPS = [
		{ num: 1 as const, label: 'Información' },
		{ num: 2 as const, label: 'Productos y Lentes' },
		{ num: 3 as const, label: 'Resumen' }
	];

	function goToStep(step: WizardStep) {
		currentStep = step;
	}

	function nextStep() {
		if (currentStep === 1 && !step1Valid) return;
		if (currentStep === 2 && !step2Valid) return;
		if (currentStep < 3) {
			currentStep = (currentStep + 1) as WizardStep;
		}
	}

	function prevStep() {
		if (currentStep > 1) currentStep = (currentStep - 1) as WizardStep;
	}

	// ============================================================================
	// FORM STATE
	// ============================================================================

	let customerId = $state('');
	let selectedCustomer = $state<Customer | null>(null);
	let newCustomer = $state<NewCustomerData | null>(null);
	let saleDate = $state<Date>(nowUTC());
	let discount = $state(0);
	let discountType = $state<DiscountTypeEnum>(DiscountType.FIXED);
	let notes = $state('');
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

	// ============================================================================
	// VALIDATION
	// ============================================================================

	const hasCustomer = $derived(
		customerId !== '' ||
			(newCustomer !== null && newCustomer.firstName !== '' && newCustomer.lastName !== '')
	);

	const step1Valid = $derived(hasCustomer);

	const itemsValid = $derived(
		items.length > 0 &&
			items.every(
				(i) =>
					(i.kind === 'product'
						? i.productId !== ''
						: (i.lensPair?.catalogItemId ?? '') !== '' &&
							(i.lensPair!.od.enabled || i.lensPair!.oi.enabled)) &&
					(i.kind === 'product' ? i.quantity > 0 : true) &&
					i.unitPrice >= 0
			)
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

	const requiredEyes = $derived(getRequiredEyes(items));

	const rxErrors = $derived(
		validatePrescriptionFields(prescriptionValues, requiredEyes.needsOd, requiredEyes.needsOi)
	);

	const hasInvalidPrescription = $derived(hasPrescriptionErrors(rxErrors));

	const step2Valid = $derived(itemsValid && !hasOutOfStockItem && !hasInvalidPrescription);

	const subtotal = $derived(calculateSaleSummarySubtotal(items));

	const hasInvalidItemDiscount = $derived(items.some((item) => !isItemDiscountValid(item)));

	const hasInvalidGlobalDiscount = $derived(
		!isDiscountValueValid(discount, discountType, subtotal)
	);

	const canSubmit = $derived(
		step1Valid && step2Valid && !hasInvalidItemDiscount && !hasInvalidGlobalDiscount && !submitting
	);

	// ============================================================================
	// STEP NAVIGATION HELPERS
	// ============================================================================

	function canNavigateToStep(stepNum: number): boolean {
		return (
			stepNum === 1 || (stepNum === 2 && step1Valid) || (stepNum === 3 && step1Valid && step2Valid)
		);
	}

	// ============================================================================
	// SUBMIT
	// ============================================================================

	async function handleSubmit() {
		if (hasInvalidItemDiscount || hasInvalidGlobalDiscount) {
			toast.error('Revise los descuentos antes de registrar la venta');
			return;
		}

		if (!canSubmit) return;
		submitting = true;

		try {
			const saleItems = buildSaleItemsFromWizard(items, products, lensItems, defaultTaxRate);
			const prescription = items.some((item) => item.kind === 'lens')
				? (buildPrescriptionPayload(
						prescriptionValues,
						dateToISODateString(saleDate)
					) as Parameters<typeof createSale>[0]['prescription'])
				: undefined;

			const result = await createSale({
				customerId: customerId || undefined,
				newCustomer:
					newCustomer && newCustomer.firstName && newCustomer.lastName ? newCustomer : undefined,
				saleDate: dateToISODateString(saleDate),
				discount,
				discountType,
				notes: notes || undefined,
				prescription,
				items: saleItems
			});

			if (!result.success) {
				toast.error(result.error ?? 'Error registrando venta');
				return;
			}

			toast.success('Venta registrada exitosamente');
			goto(resolve(`/sales/${result.sale.id}`));
		} catch (e) {
			console.error(e);
			toast.error(getErrorMessage(e, 'Error registrando venta'));
		} finally {
			submitting = false;
		}
	}
</script>

<div class="w-full">
	<WizardHeader
		title="Nueva Venta"
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
			bind:saleDate
			bind:notes
			{nextOrderNumber}
			valid={step1Valid}
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
			{nextOrderNumber}
			valid={step2Valid}
			onnext={nextStep}
			onprev={prevStep}
		/>
	</div>

	<!-- Step 3: Resumen -->
	<div class:hidden={currentStep !== 3}>
		<SaleStep3Summary
			{items}
			{customerId}
			{selectedCustomer}
			{newCustomer}
			{saleDate}
			bind:discount
			bind:discountType
			{notes}
			{nextOrderNumber}
			{defaultTaxRate}
			{products}
			{lensItems}
			{submitting}
			{canSubmit}
			onprev={prevStep}
			onsubmit={handleSubmit}
		/>
	</div>
</div>
