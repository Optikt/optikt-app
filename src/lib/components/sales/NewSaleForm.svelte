<script lang="ts">
	import { Check } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createSale } from '$lib/remote/sales.remote';
	import { getLatestCustomerPrescription } from '$lib/remote/prescriptions.remote';
	import { getErrorMessage, dateToISODateString } from '$lib/utils';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import { LensType } from '$lib/shared/enums/lensTypes';
	import { PatientEye } from '$lib/shared/contracts/common';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import {
		FulfillmentSource,
		buildFulfillmentPlan,
		type CatalogItemForPlanning,
		type SurplusUnitForPlanning,
		type FulfillmentPlanResult
	} from '$lib/shared/planning';
	import type { SaleItemInput, SurplusCreationInput } from '$lib/schemas/sales';
	import type { PrescriptionValues } from './PrescriptionInput.svelte';
	import type { Customer, Prescription, Supplier } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from './newSaleTypes';
	import { buildLensRequirements } from './saleItemHelpers';
	import SaleStep1Info from './SaleStep1Info.svelte';
	import SaleStep2Items from './SaleStep2Items.svelte';
	import SaleStep3Summary from './SaleStep3Summary.svelte';

	interface Props {
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		catalogItems: CatalogItemForPlanning[];
		availableSurplus: SurplusUnitForPlanning[];
		suppliers: Supplier[];
		nextOrderNumber?: number;
	}

	let { products, lensItems, catalogItems, availableSurplus, suppliers, nextOrderNumber }: Props =
		$props();

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
		if (step === 3) generateFulfillmentPlan();
		currentStep = step;
	}

	function nextStep() {
		if (currentStep === 1 && !step1Valid) return;
		if (currentStep === 2 && !step2Valid) return;
		if (currentStep < 3) {
			const next = (currentStep + 1) as WizardStep;
			if (next === 3) generateFulfillmentPlan();
			currentStep = next;
		}
	}

	function prevStep() {
		if (currentStep > 1) currentStep = (currentStep - 1) as WizardStep;
	}

	// ============================================================================
	// FULFILLMENT PLAN STATE
	// ============================================================================

	let planResult = $state<FulfillmentPlanResult | null>(null);

	/** Pre-built catalog map for the planner and the summary panel */
	const catalogMap = $derived(new Map(catalogItems.map((item) => [item.id, item])));

	/**
	 * Per-item overrides: when the supplier rejects a single-unit order,
	 * user clicks "Comprar par" to force pair purchase.
	 * Keyed by catalogItemId.
	 */
	let singleUnitOverrides = $state<Map<string, 'FORCE_PAIR'>>(new Map());

	/**
	 * Surplus Rx choices: user decides whether surplus gets the same Rx or not.
	 * Keyed by catalogItemId.
	 */
	let surplusRxChoices = $state<Map<string, 'SAME_RX' | 'UNDEFINED'>>(new Map());

	function applyOverrides(
		catalog: Map<string, CatalogItemForPlanning>
	): Map<string, CatalogItemForPlanning> {
		if (singleUnitOverrides.size === 0) return catalog;
		const overridden = new Map(catalog);
		for (const [itemId] of singleUnitOverrides) {
			const original = overridden.get(itemId);
			if (original) {
				overridden.set(itemId, {
					...original,
					purchasePolicy: {
						...original.purchasePolicy,
						allowsSingleUnitOrder: false
					}
				});
			}
		}
		return overridden;
	}

	function handleOverrideChange(catalogItemId: string, action: 'FORCE_PAIR' | 'UNDO') {
		const next = new Map(singleUnitOverrides);
		if (action === 'FORCE_PAIR') {
			next.set(catalogItemId, 'FORCE_PAIR');
		} else {
			next.delete(catalogItemId);
		}
		singleUnitOverrides = next;
		generateFulfillmentPlan();
	}

	function handleSurplusRxChange(catalogItemId: string, choice: 'SAME_RX' | 'UNDEFINED') {
		const next = new Map(surplusRxChoices);
		next.set(catalogItemId, choice);
		surplusRxChoices = next;
	}

	function generateFulfillmentPlan() {
		const lensItems = items.filter((i) => i.kind === 'lens');
		if (lensItems.length === 0) {
			planResult = null;
			return;
		}
		const requirements = buildLensRequirements(items);
		if (requirements.length === 0) {
			planResult = null;
			return;
		}
		const effectiveCatalog = applyOverrides(catalogMap);
		planResult = buildFulfillmentPlan(requirements, effectiveCatalog, availableSurplus);
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

	const hasIncompatibleLens = $derived(
		items.some((i) => {
			if (i.kind !== 'lens' || !i.lensPair) return false;
			const { od, oi } = i.lensPair;
			return (
				(od.enabled && od.compatibilityVerdict === 'SIGNATURE_MISMATCH') ||
				(oi.enabled && oi.compatibilityVerdict === 'SIGNATURE_MISMATCH')
			);
		})
	);

	const step2Valid = $derived(itemsValid && !hasOutOfStockItem && !hasIncompatibleLens);

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
					saleItems.push({
						productId: item.productId,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
						discount: item.discount,
						discountType: item.discountType,
						notes: item.notes || undefined
					});
					continue;
				}

				// Lens items: build per-eye items from the fulfillment plan
				if (!item.lensPair || !planResult) continue;

				const pair = item.lensPair;
				const eyes = [
					{ entry: pair.od, eye: PatientEye.OD, suffix: 'od' as const },
					{ entry: pair.oi, eye: PatientEye.OI, suffix: 'oi' as const }
				];

				for (const { entry, eye, suffix } of eyes) {
					if (!entry.enabled) continue;

					// Find the matching plan line for this requirement
					const reqId = `${item.id}-${suffix}`;
					const planLine = planResult.lines.find((l) => l.requirementId === reqId);

					saleItems.push({
						lensCatalogItemId: pair.catalogItemId,
						eye,
						fulfillmentSource: planLine?.source,
						surplusUnitId: planLine?.surplusUnitId ?? undefined,
						selectedTreatments: pair.selectedOptionalTreatments,
						costBreakdown: planLine?.cost ?? undefined,
						prescriptionId: customerPrescription?.id,
						odSphere: entry.prescription.sphere ?? undefined,
						odCylinder: entry.prescription.cylinder ?? undefined,
						odAxis: entry.prescription.axis ?? undefined,
						odAddition: entry.prescription.addition ?? undefined,
						quantity: 1,
						unitPrice: item.unitPrice,
						discount: item.discount,
						discountType: item.discountType,
						notes: item.notes || undefined
					});
				}
			}

			// Build surplus to create from plan + user Rx choices
			const surplusToCreate: SurplusCreationInput[] = [];
			if (planResult) {
				for (const surplus of planResult.surplus) {
					const catalogItem = catalogMap.get(surplus.catalogItemId);
					const lensItem = lensItems.find((l) => l.id === surplus.catalogItemId);
					if (!catalogItem || !lensItem) continue;

					const rxChoice = surplusRxChoices.get(surplus.catalogItemId) ?? 'UNDEFINED';

					// Find the ordered eye's prescription for SAME_RX
					let prescription = surplus.predeterminedPrescription;
					if (rxChoice === 'SAME_RX' && !prescription) {
						// Use sourceRequirementId to find the exact wizard item + eye
						for (const item of items) {
							if (item.kind !== 'lens' || !item.lensPair) continue;
							const reqId = surplus.sourceRequirementId;
							if (reqId === `${item.id}-od` && item.lensPair.od.enabled) {
								prescription = { ...item.lensPair.od.prescription };
								break;
							}
							if (reqId === `${item.id}-oi` && item.lensPair.oi.enabled) {
								prescription = { ...item.lensPair.oi.prescription };
								break;
							}
						}
					}

					surplusToCreate.push({
						catalogItemId: surplus.catalogItemId,
						supplierId: lensItem.supplierId,
						prescription: prescription ?? null,
						selectedTreatments: surplus.predeterminedTreatments ?? null,
						costSnapshot: {
							basePrice: surplus.surplusCostIncluded,
							treatmentPrice: 0,
							mountingPrice: 0,
							shippingPrice: 0,
							surchargePrice: 0,
							totalCost: surplus.surplusCostIncluded
						}
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
				items: saleItems,
				surplusToCreate
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
			{catalogItems}
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
			{planResult}
			{catalogMap}
			{singleUnitOverrides}
			{surplusRxChoices}
			{submitting}
			{canSubmit}
			onprev={prevStep}
			onsubmit={handleSubmit}
			onoverridechange={handleOverrideChange}
			onsurplusrxchange={handleSurplusRxChange}
		/>
	</div>
</div>
