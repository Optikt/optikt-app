<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createNewQuote } from '$lib/remote/quotes.remote';
	import { getLatestCustomerPrescription } from '$lib/remote/prescriptions.remote';
	import { getErrorMessage, dateToISODateString } from '$lib/utils';
	import { nowUTC } from '$lib/dates';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import { LensType, SaleItemType } from '$lib/shared/enums/lensTypes';
	import { PatientEye } from '$lib/shared/contracts/common';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { QuoteItemInput } from '$lib/schemas/quotes';
	import type { PrescriptionValues } from '$lib/components/sales/PrescriptionInput.svelte';
	import type { Customer, Prescription, Supplier } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import { WizardHeader } from '$lib/components/ui';
	import {
		getRequiredEyes,
		validatePrescriptionFields,
		hasPrescriptionErrors
	} from '$lib/components/sales/saleItemHelpers';
	import SaleStep1Info from '$lib/components/sales/SaleStep1Info.svelte';
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

	function canNavigateToStep(stepNum: number): boolean {
		return stepNum === 1 || stepNum === 2 || (stepNum === 3 && step2Valid);
	}

	function goToQuotes() {
		goto(resolve('/quotes'));
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
		lensType: LensType.MONOFOCAL
	});

	// ============================================================================
	// ITEMS STATE
	// ============================================================================

	let items = $state<SaleItemRow[]>([]);

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
						snapshotBaseCost: lens?.pairPurchasePrice,
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

<div class="w-full space-y-8">
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
			{products}
			{lensItems}
			{submitting}
			{canSubmit}
			onprev={prevStep}
			onsubmit={handleSubmit}
		/>
	</div>
</div>
