<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createSale } from '$lib/remote/sales.remote';
	import { getLatestCustomerPrescription } from '$lib/remote/prescriptions.remote';
	import { getErrorMessage, dateToISODateString } from '$lib/utils';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import { LensType, SaleItemType } from '$lib/shared/enums/lensTypes';
	import { PatientEye } from '$lib/shared/contracts/common';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { SaleItemInput } from '$lib/schemas/sales';
	import type { PrescriptionValues } from './PrescriptionInput.svelte';
	import type { Customer, Prescription, Supplier } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from './newSaleTypes';
	import {
		getRequiredEyes,
		validatePrescriptionFields,
		hasPrescriptionErrors
	} from './saleItemHelpers';
	import SaleStep1Info from './SaleStep1Info.svelte';
	import SaleStep2Items from './SaleStep2Items.svelte';
	import SaleStep3Summary from './SaleStep3Summary.svelte';

	interface Props {
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		suppliers: Supplier[];
		nextOrderNumber?: number;
	}

	let { products, lensItems, suppliers: _suppliers, nextOrderNumber }: Props = $props();

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
	let saleDate = $state<Date>(new Date());
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
				const p = products.find((pr) => pr.id === i.productId);
				const maxStock = p?.stock ?? null;
				if (maxStock === null) return false;
				return maxStock <= 0 || i.quantity > maxStock;
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

	const canSubmit = $derived(step1Valid && step2Valid && !submitting);

	// ============================================================================
	// STEP NAVIGATION HELPERS
	// ============================================================================

	function stepButtonClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;
		const isClickable =
			stepNum === 1 || (stepNum === 2 && step1Valid) || (stepNum === 3 && step1Valid && step2Valid);

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
			const saleItems: SaleItemInput[] = [];

			for (const item of items) {
				if (item.kind === 'product') {
					const product = products.find((p) => p.id === item.productId);
					saleItems.push({
						itemType: SaleItemType.PRODUCT,
						productId: item.productId,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
						discount: item.discount,
						discountType: item.discountType,
						notes: item.notes || undefined,
						snapshotName: product?.name,
						snapshotSku: product?.sku ?? undefined,
						snapshotBrand: product?.brand?.name ?? undefined
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

				// Compute per-eye lens-only price (treatments are sent as separate items)
				const enabledEyes = eyes.filter(({ entry }) => entry.enabled);
				const eyeCount = enabledEyes.length;
				const treatmentsSum = item.treatments.reduce((sum, t) => sum + t.price, 0) * eyeCount;
				const lensOnlyTotal = item.unitPrice - treatmentsSum;
				const perEyeUnitPrice = eyeCount > 0 ? lensOnlyTotal / eyeCount : 0;

				// Generate a stable parent ID for the first lens eye item
				// so treatment items can reference it
				const parentLensItemId = crypto.randomUUID();
				let isFirstEye = true;

				for (const { entry } of eyes) {
					if (!entry.enabled) continue;

					const lensItemId = isFirstEye ? parentLensItemId : crypto.randomUUID();

					saleItems.push({
						id: lensItemId,
						itemType: SaleItemType.LENS_PAIR,
						lensCatalogItemId: pair.catalogItemId,
						prescriptionId: customerPrescription?.id,
						odSphere: entry.prescription.sphere ?? undefined,
						odCylinder: entry.prescription.cylinder ?? undefined,
						odAxis: entry.prescription.axis ?? undefined,
						odAddition: entry.prescription.addition ?? undefined,
						quantity: 1,
						unitPrice: perEyeUnitPrice,
						// FIXED discount goes on first eye only; PERCENTAGE works on each eye
						discount: item.discountType === DiscountType.FIXED && !isFirstEye ? 0 : item.discount,
						discountType: item.discountType,
						notes: item.notes || undefined,
						snapshotName: lens?.name,
						snapshotBrand: lens?.supplier?.name ?? undefined,
						snapshotBaseCost: lens?.basePrice,
						snapshotMountingPrice: lens?.mountingPrice,
						snapshotShippingPrice: lens?.shippingPrice,
						snapshotSalePrice: lens?.salePrice ?? undefined,
						snapshotPriceType: lens?.priceType
					});

					isFirstEye = false;
				}

				// Emit treatment items linked to the parent lens item
				for (const t of item.treatments) {
					saleItems.push({
						itemType: SaleItemType.TREATMENT,
						parentSaleItemId: parentLensItemId,
						supplierTreatmentId: t.supplierTreatmentId,
						quantity: eyeCount,
						unitPrice: t.price,
						discount: 0,
						discountType: DiscountType.FIXED,
						snapshotName: t.name,
						snapshotBrand: lens?.supplier?.name ?? undefined,
						snapshotTreatmentCategory: t.category
					});
				}
			}

			const result = await createSale({
				customerId: customerId || undefined,
				newCustomer:
					newCustomer && newCustomer.firstName && newCustomer.lastName ? newCustomer : undefined,
				saleDate: dateToISODateString(saleDate),
				discount,
				discountType,
				notes: notes || undefined,
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

<div class="mx-auto max-w-5xl space-y-8">
	<!-- Wizard Steps Indicator -->
	<nav class="flex items-center justify-center gap-3">
		{#each STEPS as step (step.num)}
			{@const isClickable =
				step.num === 1 ||
				(step.num === 2 && step1Valid) ||
				(step.num === 3 && step1Valid && step2Valid)}
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
			{products}
			{lensItems}
			{submitting}
			{canSubmit}
			onprev={prevStep}
			onsubmit={handleSubmit}
		/>
	</div>
</div>
