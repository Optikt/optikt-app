<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createNewQuote } from '$lib/remote/quotes.remote';
	import { getLatestCustomerPrescription } from '$lib/remote/prescriptions.remote';
	import { getErrorMessage, dateToISODateString } from '$lib/utils';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import { LensType, SaleItemType } from '$lib/shared/enums/lensTypes';
	import { PatientEye } from '$lib/shared/contracts/common';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { QuoteItemInput } from '$lib/schemas/quotes';
	import type { PrescriptionValues } from '$lib/components/sales/PrescriptionInput.svelte';
	import type { Customer, Prescription, Supplier } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import {
		getRequiredEyes,
		validatePrescriptionFields,
		hasPrescriptionErrors
	} from '$lib/components/sales/saleItemHelpers';
	import QuoteStep1Info from './QuoteStep1Info.svelte';
	import SaleStep2Items from '$lib/components/sales/SaleStep2Items.svelte';
	import QuoteStep3Summary from './QuoteStep3Summary.svelte';

	interface Props {
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		suppliers: Supplier[];
		nextQuoteNumber?: number;
	}

	let { products, lensItems, suppliers: _suppliers, nextQuoteNumber }: Props = $props();

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
	let quoteDate = $state<Date>(new Date());
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
		lensType: LensType.MONOFOCAL
	});

	// ============================================================================
	// ITEMS STATE
	// ============================================================================

	let items = $state<SaleItemRow[]>([
		{
			id: crypto.randomUUID(),
			kind: 'product',
			productId: '',
			quantity: 1,
			lensPair: null,
			treatments: [],
			unitPrice: 0,
			discount: 0,
			discountType: DiscountType.FIXED,
			notes: ''
		}
	]);

	// ============================================================================
	// VALIDATION
	// ============================================================================

	// Step 1: always valid (customer optional for quotes)

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

	function stepButtonClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;
		const isClickable = stepNum === 1 || stepNum === 2 || (stepNum === 3 && step2Valid);

		const base =
			'flex items-center gap-2.5 rounded-xl px-5 py-2.5 text-base font-medium transition-all';
		const state = isActive
			? 'bg-blue-600 text-white shadow-md'
			: isComplete
				? 'bg-blue-50 text-blue-700'
				: 'text-slate-400';
		const cursor = !isClickable
			? 'cursor-not-allowed'
			: !isActive
				? 'cursor-pointer hover:bg-slate-100'
				: '';
		return `${base} ${state} ${cursor}`;
	}

	function stepBadgeClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;
		const base = 'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold';
		const state = isActive
			? 'bg-white text-blue-600'
			: isComplete
				? 'bg-blue-600 text-white'
				: 'bg-slate-200 text-slate-500';
		return `${base} ${state}`;
	}

	// ============================================================================
	// SUBMIT
	// ============================================================================

	async function handleSubmit() {
		if (!canSubmit) return;
		submitting = true;

		try {
			const quoteItems: QuoteItemInput[] = [];

			for (const item of items) {
				if (item.kind === 'product') {
					const product = products.find((p) => p.id === item.productId);
					quoteItems.push({
						itemType: SaleItemType.PRODUCT,
						productId: item.productId,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
						discount: item.discount,
						discountType: item.discountType,
						notes: item.notes || undefined,
						snapshotName: product?.name,
						snapshotSku: product?.sku ?? undefined,
						snapshotBrand: product?.brand?.name ?? undefined,
						snapshotIsTaxable: product?.isTaxable ?? true,
						snapshotTaxRate: product?.taxRate ?? 16
					});
					continue;
				}

				// Lens items: build per-eye items
				if (!item.lensPair) continue;

				const pair = item.lensPair;
				const lens = lensItems.find((l) => l.id === pair.catalogItemId);
				const eyes = [
					{ entry: pair.od, eye: PatientEye.OD, suffix: 'od' as const },
					{ entry: pair.oi, eye: PatientEye.OI, suffix: 'oi' as const }
				];

				// unitPrice is already lens-only (treatments are sent as separate items)
				const enabledEyes = eyes.filter(({ entry }) => entry.enabled);
				const eyeCount = enabledEyes.length;
				const perEyeUnitPrice = eyeCount > 0 ? item.unitPrice / eyeCount : 0;

				const parentLensItemId = crypto.randomUUID();
				let isFirstEye = true;

				for (const { entry } of eyes) {
					if (!entry.enabled) continue;

					const lensItemId = isFirstEye ? parentLensItemId : crypto.randomUUID();

					quoteItems.push({
						id: lensItemId,
						itemType: SaleItemType.LENS_PAIR,
						lensCatalogItemId: pair.catalogItemId,
						odSphere: entry.prescription.sphere ?? undefined,
						odCylinder: entry.prescription.cylinder ?? undefined,
						odAxis: entry.prescription.axis ?? undefined,
						odAddition: entry.prescription.addition ?? undefined,
						quantity: 1,
						unitPrice: perEyeUnitPrice,
						discount: item.discountType === DiscountType.FIXED && !isFirstEye ? 0 : item.discount,
						discountType: item.discountType,
						notes: item.notes || undefined,
						snapshotName: lens?.name,
						snapshotBrand: lens?.supplier?.name ?? undefined,
						snapshotBaseCost: lens?.basePrice,
						snapshotMountingPrice: lens?.mountingPrice,
						snapshotShippingPrice: lens?.shippingPrice,
						snapshotSalePrice: lens?.salePrice ?? undefined,
						snapshotPriceType: lens?.priceType,
						snapshotIsTaxable: lens?.isTaxable ?? false,
						snapshotTaxRate: lens?.taxRate ?? 16
					});

					isFirstEye = false;
				}

				// Treatment items linked to parent lens
				for (const t of item.treatments) {
					quoteItems.push({
						itemType: SaleItemType.TREATMENT,
						parentQuoteItemId: parentLensItemId,
						supplierTreatmentId: t.supplierTreatmentId,
						quantity: eyeCount,
						unitPrice: t.price,
						discount: 0,
						discountType: DiscountType.FIXED,
						snapshotName: t.name,
						snapshotBrand: lens?.supplier?.name ?? undefined,
						snapshotTreatmentCategory: t.category,
						snapshotIsTaxable: t.isTaxable,
						snapshotTaxRate: t.taxRate
					});
				}
			}

			const result = await createNewQuote({
				customerId: customerId || undefined,
				newCustomer:
					newCustomer && newCustomer.firstName && newCustomer.lastName ? newCustomer : undefined,
				quoteDate: dateToISODateString(quoteDate),
				discount,
				discountType,
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

<div class="mx-auto max-w-5xl space-y-8">
	<!-- Wizard Steps Indicator -->
	<nav class="flex items-center justify-center gap-3">
		{#each STEPS as step (step.num)}
			{@const isClickable = step.num === 1 || step.num === 2 || (step.num === 3 && step2Valid)}
			<button
				onclick={() => {
					if (isClickable) goToStep(step.num);
				}}
				disabled={!isClickable}
				class={stepButtonClass(step.num)}
			>
				<span class={stepBadgeClass(step.num)}>
					{#if currentStep > step.num}
						<Check class="h-4 w-4" />
					{:else}
						{step.num}
					{/if}
				</span>
				{step.label}
			</button>
			{#if step.num < 3}
				<div class="h-px w-10 {currentStep > step.num ? 'bg-blue-300' : 'bg-slate-200'}"></div>
			{/if}
		{/each}
	</nav>

	<!-- Step 1: Información -->
	<div class:hidden={currentStep !== 1}>
		<QuoteStep1Info
			bind:customerId
			bind:selectedCustomer
			bind:newCustomer
			bind:quoteDate
			bind:notes
			bind:validUntil
			{nextQuoteNumber}
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
			{products}
			{lensItems}
			{submitting}
			{canSubmit}
			onprev={prevStep}
			onsubmit={handleSubmit}
		/>
	</div>
</div>
