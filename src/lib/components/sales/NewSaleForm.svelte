<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createSale } from '$lib/remote/sales.remote';
	import { getLatestCustomerPrescription } from '$lib/remote/prescriptions.remote';
	import { getErrorMessage, dateToISODateString } from '$lib/utils';
	import { isDiscountValueValid } from '$lib/utils';
	import { nowUTC } from '$lib/dates';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import { LensType, SaleItemType } from '$lib/shared/enums/lensTypes';
	import { PatientEye } from '$lib/shared/contracts/common';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { SaleItemInput } from '$lib/schemas/sales';
	import type { PrescriptionValues } from './PrescriptionInput.svelte';
	import type { Customer, Prescription, Supplier } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from './newSaleTypes';
	import { PageHeader } from '$lib/components/ui';
	import {
		calculateSaleSummarySubtotal,
		getAvailableProductStock,
		getRequiredEyes,
		isItemDiscountValid,
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
		lensType: LensType.MONOFOCAL
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

	function stepButtonClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;
		const isClickable =
			stepNum === 1 || (stepNum === 2 && step1Valid) || (stepNum === 3 && step1Valid && step2Valid);

		const base = 'group flex flex-col items-center gap-3 text-center transition-all duration-200';
		const state = isActive || isComplete ? 'text-brand-navy' : 'text-slate-400';
		const cursor = !isClickable ? 'cursor-not-allowed' : 'cursor-pointer';
		return `${base} ${state} ${cursor}`;
	}

	function stepBadgeClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;
		const base =
			'flex h-12 w-12 items-center justify-center rounded-2xl font-mono text-base font-bold transition-all duration-200';
		const state = isActive
			? 'bg-brand-navy text-white shadow-[0_18px_40px_rgba(21,35,70,0.18)]'
			: isComplete
				? 'bg-brand-gold text-brand-navy shadow-sm'
				: 'bg-surface-container-high text-outline group-hover:bg-surface-container-highest group-hover:text-brand-navy';
		return `${base} ${state}`;
	}

	function stepLabelClass(stepNum: number): string {
		const isActive = currentStep === stepNum;
		const isComplete = currentStep > stepNum;
		const base = 'text-[11px] font-semibold tracking-[0.16em] uppercase whitespace-nowrap';
		const state =
			isActive || isComplete
				? 'text-brand-navy'
				: 'text-slate-400 group-hover:text-on-surface-variant';
		return `${base} ${state}`;
	}

	function stepConnectorClass(stepNum: number): string {
		return `mt-6 h-px w-10 shrink-0 rounded-full sm:w-16 ${currentStep > stepNum ? 'bg-brand-gold/70' : 'bg-surface-container-high'}`;
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
						snapshotBaseCost: item.costOverrides?.baseCost ?? lens?.pairPurchasePrice,
						snapshotMountingPrice: item.costOverrides?.mountingPrice ?? lens?.mountingPrice,
						snapshotShippingPrice: item.shippingCostPending
							? undefined
							: (item.costOverrides?.shippingPrice ?? lens?.shippingPrice),
						snapshotSalePrice: lens?.salePrice ?? undefined,
						snapshotPriceType: lens?.priceType,
						snapshotIsTaxable: lens?.isTaxable ?? false,
						snapshotTaxRate: lens?.taxRate ?? 16,
						shippingCostPending: item.shippingCostPending || undefined
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
						snapshotTreatmentCategory: t.category,
						snapshotIsTaxable: t.isTaxable,
						snapshotTaxRate: t.taxRate
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

<div class="w-full">
	<PageHeader title="Nueva Venta">
		{#snippet actions()}
			<nav aria-label="Progreso de la venta" class="overflow-x-auto xl:-mt-4 xl:pt-0">
				<div class="flex min-w-max items-start justify-start gap-2 px-1 sm:gap-4 xl:justify-end">
					{#each STEPS as step (step.num)}
						{@const isClickable =
							step.num === 1 ||
							(step.num === 2 && step1Valid) ||
							(step.num === 3 && step1Valid && step2Valid)}
						<div class="flex items-start gap-2 sm:gap-4">
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
								<span class={stepLabelClass(step.num)}>{step.label}</span>
							</button>
							{#if step.num < 3}
								<div class={stepConnectorClass(step.num)}></div>
							{/if}
						</div>
					{/each}
				</div>
			</nav>
		{/snippet}
	</PageHeader>

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
