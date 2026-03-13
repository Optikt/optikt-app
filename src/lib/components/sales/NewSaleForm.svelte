<script lang="ts">
	import { Button, Select, Input, Label, Spinner, Textarea } from 'flowbite-svelte';
	import {
		Plus,
		Trash2,
		ShoppingCart,
		ChevronLeft,
		ChevronRight,
		Check,
		User,
		Calendar,
		FileText,
		Hash,
		CheckCircle,
		AlertTriangle,
		XCircle,
		Eye
	} from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { createSale } from '$lib/remote/sales.remote';
	import { getLatestCustomerPrescription } from '$lib/remote/prescriptions.remote';
	import {
		formatPrice,
		getErrorMessage,
		dateToISODateString,
		checkLensMatch,
		hasPrescriptionData,
		MATCH_DISPLAY
	} from '$lib/utils';
	import type { PrescriptionForMatching } from '$lib/utils/lensMatching';
	import {
		ALL_DISCOUNT_TYPES,
		DiscountType,
		type DiscountType as DiscountTypeEnum
	} from '$lib/shared/enums';
	import {
		LensType,
		getLensTypeLabel,
		getLensSourceLabel,
		getPricingUnitLabel
	} from '$lib/shared/enums/lensTypes';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { SaleItemInput } from '$lib/schemas/sales';
	import { getProductTypeLabel, getProductTypeBadgeColor } from '$lib/shared/enums/productTypes';
	import CustomerLookupInput from './CustomerLookupInput.svelte';
	import ItemSelect from './ItemSelect.svelte';
	import PrescriptionInput from './PrescriptionInput.svelte';
	import type { PrescriptionValues } from './PrescriptionInput.svelte';
	import type { Customer, Prescription } from '$lib/server/db/schema';

	interface Props {
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		nextOrderNumber?: number;
	}

	let { products, lensItems, nextOrderNumber }: Props = $props();

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
		if (currentStep < 3) currentStep = (currentStep + 1) as WizardStep;
	}

	function prevStep() {
		if (currentStep > 1) currentStep = (currentStep - 1) as WizardStep;
	}

	// ============================================================================
	// FORM STATE
	// ============================================================================

	let customerId = $state('');
	let selectedCustomer = $state<Customer | null>(null);
	let newCustomer = $state<{
		firstName: string;
		lastName: string;
		idNumber: string;
		primaryPhone: string;
		email: string;
		address: string;
		notes: string;
	} | null>(null);
	let saleDate = $state<Date>(new Date());
	let discount = $state(0);
	let discountType = $state<DiscountTypeEnum>(DiscountType.FIXED);
	let notes = $state('');
	let submitting = $state(false);

	// ============================================================================
	// CUSTOMER PRESCRIPTION STATE
	// ============================================================================

	let customerPrescription = $state<Prescription | null>(null);

	/** Fetch latest prescription when customer changes */
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

	// Watch for customer changes and fetch prescription
	$effect(() => {
		const id = customerId || selectedCustomer?.id;
		if (id) {
			fetchCustomerPrescription(id);
		} else {
			customerPrescription = null;
		}
	});

	// ============================================================================
	// SHARED PRESCRIPTION STATE (one per sale, shared across all lens items)
	// ============================================================================

	let prescriptionValues = $state<PrescriptionValues>({
		odSphere: '',
		odCylinder: '',
		odAxis: '',
		odAddition: '',
		osSphere: '',
		osCylinder: '',
		osAxis: '',
		osAddition: '',
		lensType: LensType.MONOFOCAL
	});

	// ============================================================================
	// ITEMS STATE
	// ============================================================================

	type ItemKind = 'product' | 'lens';

	interface SaleItemRow {
		id: string;
		kind: ItemKind;
		productId: string;
		lensCatalogItemId: string;
		quantity: number;
		unitPrice: number;
		discount: number;
		discountType: DiscountTypeEnum;
		notes: string;
	}

	let items = $state<SaleItemRow[]>([createEmptyItem()]);

	/** True if any item is a lens */
	const hasLensItem = $derived(items.some((i) => i.kind === 'lens'));

	function createEmptyItem(): SaleItemRow {
		return {
			id: crypto.randomUUID(),
			kind: 'product',
			productId: '',
			lensCatalogItemId: '',
			quantity: 1,
			unitPrice: 0,
			discount: 0,
			discountType: DiscountType.FIXED,
			notes: ''
		};
	}

	function addItem() {
		items = [...items, createEmptyItem()];
	}

	function removeItem(id: string) {
		if (items.length <= 1) return;
		items = items.filter((i) => i.id !== id);
	}

	function handleKindChange(item: SaleItemRow) {
		item.productId = '';
		item.lensCatalogItemId = '';
		item.unitPrice = 0;
	}

	function handleItemSelect(item: SaleItemRow, id: string, unitPrice: number) {
		if (item.kind === 'product') {
			item.productId = id;
		} else {
			item.lensCatalogItemId = id;
		}
		item.unitPrice = unitPrice;
	}

	// ============================================================================
	// LENS MATCHING
	// ============================================================================

	/** Build PrescriptionForMatching from the shared prescription values */
	function buildRxForMatching(): PrescriptionForMatching {
		const parseNum = (v: string): number | null => {
			if (v === '') return null;
			const n = parseFloat(v);
			return isNaN(n) ? null : n;
		};
		return {
			od: {
				sphere: parseNum(prescriptionValues.odSphere),
				cylinder: parseNum(prescriptionValues.odCylinder),
				axis: parseNum(prescriptionValues.odAxis),
				addition: parseNum(prescriptionValues.odAddition)
			},
			os: {
				sphere: parseNum(prescriptionValues.osSphere),
				cylinder: parseNum(prescriptionValues.osCylinder),
				axis: parseNum(prescriptionValues.osAxis),
				addition: parseNum(prescriptionValues.osAddition)
			}
		};
	}

	/** Get lens match result for a given item against the shared prescription */
	function getLensMatch(item: SaleItemRow) {
		if (item.kind !== 'lens' || !item.lensCatalogItemId) return null;
		const lens = lensItems.find((l) => l.id === item.lensCatalogItemId);
		if (!lens) return null;
		const rx = buildRxForMatching();
		if (!hasPrescriptionData(rx)) return null;
		return checkLensMatch(lens.ranges, rx);
	}

	/** Get the lens catalog item for a sale item */
	function getLensItem(item: SaleItemRow): LensCatalogItemWithRelations | undefined {
		return lensItems.find((l) => l.id === item.lensCatalogItemId);
	}

	// ============================================================================
	// DERIVED TOTALS
	// ============================================================================

	function computeItemDiscount(item: SaleItemRow): number {
		const lineTotal = item.unitPrice * item.quantity;
		if (item.discountType === DiscountType.PERCENTAGE) {
			return (item.discount / 100) * lineTotal;
		}
		return item.discount;
	}

	function itemLineTotal(item: SaleItemRow): number {
		return item.unitPrice * item.quantity - computeItemDiscount(item);
	}

	const subtotal = $derived(items.reduce((acc, item) => acc + itemLineTotal(item), 0));

	const globalDiscountAmount = $derived(
		discountType === DiscountType.PERCENTAGE ? (discount / 100) * subtotal : discount
	);

	const total = $derived(Math.max(0, subtotal - globalDiscountAmount));

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
					(i.kind === 'product' ? i.productId !== '' : i.lensCatalogItemId !== '') &&
					i.quantity > 0 &&
					i.unitPrice >= 0
			)
	);

	/** True when any PRODUCT item has insufficient stock (lenses are on-demand, stock is informational) */
	const hasOutOfStockItem = $derived(
		items.some((i) => {
			if (i.kind === 'lens') return false; // lenses are ordered on demand
			const maxStock = getItemMaxStock(i);
			if (maxStock === null) return false;
			return maxStock <= 0 || i.quantity > maxStock;
		})
	);

	/** True when any lens item has an incompatible prescription (none match) */
	const hasIncompatibleLens = $derived(
		items.some((i) => {
			if (i.kind !== 'lens' || !i.lensCatalogItemId) return false;
			const match = getLensMatch(i);
			// Only block if prescription data was entered AND it's incompatible
			return match !== null && match.overall === 'none';
		})
	);

	const step2Valid = $derived(itemsValid && !hasOutOfStockItem && !hasIncompatibleLens);

	const canSubmit = $derived(step1Valid && step2Valid && !submitting);

	// ============================================================================
	// HELPERS
	// ============================================================================

	/** Compute step button classes reactively */
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

	/** Compute step number badge classes reactively */
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

	/** Get display name for an item */
	function getItemName(item: SaleItemRow): string {
		if (item.kind === 'product') {
			const p = products.find((p) => p.id === item.productId);
			return p ? `${p.name}${p.sku ? ` (${p.sku})` : ''}` : '—';
		}
		const l = lensItems.find((l) => l.id === item.lensCatalogItemId);
		return l ? `${l.name}${l.brand ? ` (${l.brand})` : ''}` : '—';
	}

	/** Get available stock for an item (null = unlimited) */
	function getItemMaxStock(item: SaleItemRow): number | null {
		if (item.kind === 'product' && item.productId) {
			const p = products.find((p) => p.id === item.productId);
			return p?.stock ?? null;
		}
		if (item.kind === 'lens' && item.lensCatalogItemId) {
			const l = lensItems.find((l) => l.id === item.lensCatalogItemId);
			return l?.stock ?? null;
		}
		return null;
	}

	/** Get the product type for display in step 3 */
	function getItemProductType(item: SaleItemRow): string | null {
		if (item.kind === 'product' && item.productId) {
			const p = products.find((p) => p.id === item.productId);
			return p?.type ?? null;
		}
		return null;
	}

	// ============================================================================
	// SUBMIT
	// ============================================================================

	async function handleSubmit() {
		if (!canSubmit) return;
		submitting = true;

		try {
			const parseOpt = (v: string): number | undefined => {
				if (v === '') return undefined;
				const n = parseFloat(v);
				return isNaN(n) ? undefined : n;
			};

			const saleItems: SaleItemInput[] = items.map((item) => ({
				productId: item.kind === 'product' ? item.productId : undefined,
				lensCatalogItemId: item.kind === 'lens' ? item.lensCatalogItemId : undefined,
				quantity: item.quantity,
				unitPrice: item.unitPrice,
				discount: item.discount,
				discountType: item.discountType,
				notes: item.notes || undefined,
				// Prescription snapshot from shared values for all lens items
				...(item.kind === 'lens'
					? {
							prescriptionId: customerPrescription?.id,
							odSphere: parseOpt(prescriptionValues.odSphere),
							odCylinder: parseOpt(prescriptionValues.odCylinder),
							odAxis: parseOpt(prescriptionValues.odAxis),
							odAddition: parseOpt(prescriptionValues.odAddition),
							osSphere: parseOpt(prescriptionValues.osSphere),
							osCylinder: parseOpt(prescriptionValues.osCylinder),
							osAxis: parseOpt(prescriptionValues.osAxis),
							osAddition: parseOpt(prescriptionValues.osAddition)
						}
					: {})
			}));

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

	<!-- ========================================================================
	     STEP 1: Información de la Venta
	     ======================================================================== -->
	<div class:hidden={currentStep !== 1}>
		<div class="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
			<div class="mb-6 flex items-center justify-between">
				<h3 class="text-xl font-semibold text-slate-800">Información de la Venta</h3>
				{#if nextOrderNumber}
					<div class="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2">
						<Hash class="h-5 w-5 text-blue-500" />
						<span class="font-mono text-lg font-bold text-blue-700">Orden {nextOrderNumber}</span>
					</div>
				{/if}
			</div>

			<div class="grid gap-5 sm:grid-cols-2">
				<!-- Customer Lookup -->
				<div class="sm:col-span-2">
					<CustomerLookupInput bind:customerId bind:newCustomer bind:selectedCustomer />
				</div>

				<!-- Date -->
				<div>
					<Label for="saleDate" class="mb-2 text-sm">Fecha de Venta *</Label>
					<Input
						id="saleDate"
						type="date"
						value={dateToISODateString(saleDate)}
						oninput={(e: Event) => {
							const target = e.target as HTMLInputElement;
							saleDate = new Date(target.value + 'T00:00:00');
						}}
					/>
				</div>

				<!-- Notes -->
				<div>
					<Label for="notes" class="mb-2 text-sm">Notas</Label>
					<Textarea
						id="notes"
						bind:value={notes}
						placeholder="Observaciones adicionales..."
						rows={1}
						class="min-h-[42px] w-full"
					/>
				</div>
			</div>
		</div>

		<!-- Step 1 Navigation -->
		<div class="mt-6 flex justify-end">
			<Button color="blue" size="lg" onclick={nextStep} disabled={!step1Valid}>
				Siguiente
				<ChevronRight class="ml-1 h-4 w-4" />
			</Button>
		</div>
	</div>

	<!-- ========================================================================
	     STEP 2: Productos y Lentes
	     ======================================================================== -->
	<div class:hidden={currentStep !== 2}>
		<!-- Customer reference banner -->
		{#if selectedCustomer || newCustomer}
			<div
				class="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-100 px-4 py-2.5"
			>
				<User class="h-4 w-4 shrink-0 text-blue-600" />
				<p class="text-sm text-slate-800">
					<span class="font-semibold text-slate-900">
						{#if newCustomer}
							{newCustomer.firstName} {newCustomer.lastName}
						{:else if selectedCustomer}
							{selectedCustomer.firstName} {selectedCustomer.lastName}
						{/if}
					</span>
					<span class="mx-1.5 text-slate-300">·</span>
					<span class="font-mono text-slate-500">
						{#if newCustomer}
							{newCustomer.idNumber}
						{:else if selectedCustomer}
							{selectedCustomer.idNumber}
						{/if}
					</span>
				</p>
			</div>
		{/if}

		<!-- Shared Prescription Panel — appears when any lens item exists -->
		{#if hasLensItem}
			<div
				class="mb-4 rounded-xl border-2 border-violet-300 bg-gradient-to-br from-violet-50 to-indigo-50 p-5 shadow-sm"
			>
				<div class="mb-3 flex items-center gap-2.5">
					<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500">
						<Eye class="h-4 w-4 text-white" />
					</div>
					<div>
						<h4 class="text-base font-bold text-violet-900">Fórmula del Paciente</h4>
						<p class="text-xs text-violet-500">Se aplica a todos los lentes de esta venta</p>
					</div>
				</div>
				<PrescriptionInput
					bind:values={prescriptionValues}
					existingPrescription={customerPrescription}
					showAddition={prescriptionValues.lensType !== 'MONOFOCAL'}
				/>
			</div>
		{/if}

		<div class="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
			<div class="mb-6 flex items-center justify-between">
				<div class="flex items-center gap-4">
					<h3 class="text-xl font-semibold text-slate-800">Productos y Lentes</h3>
					{#if nextOrderNumber}
						<div class="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2">
							<Hash class="h-5 w-5 text-blue-500" />
							<span class="font-mono text-lg font-bold text-blue-700">Orden {nextOrderNumber}</span>
						</div>
					{/if}
				</div>
				<Button color="light" onclick={addItem}>
					<Plus class="mr-1.5 h-4 w-4" />
					Agregar Ítem
				</Button>
			</div>

			<div class="space-y-5">
				{#each items as item, index (item.id)}
					{@const maxStock = getItemMaxStock(item)}
					<div
						class="rounded-lg border p-5 {item.kind === 'lens'
							? 'border-violet-200 bg-violet-50/30'
							: 'border-slate-200 bg-slate-50/50'}"
					>
						<div class="mb-4 flex items-center justify-between">
							<span
								class="text-base font-semibold {item.kind === 'lens'
									? 'text-violet-700'
									: 'text-slate-600'}"
							>
								Ítem #{index + 1}
								{#if item.kind === 'lens'}
									<span class="ml-2 text-xs font-normal text-violet-400">— lente</span>
								{/if}
							</span>
							<div class="flex items-center gap-2">
								<!-- Kind toggle -->
								<Select bind:value={item.kind} onchange={() => handleKindChange(item)} class="w-40">
									<option value="product">Producto</option>
									<option value="lens">Lente</option>
								</Select>
								{#if items.length > 1}
									<button
										onclick={() => removeItem(item.id)}
										class="rounded-lg p-2 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600"
										title="Eliminar"
									>
										<Trash2 class="h-5 w-5" />
									</button>
								{/if}
							</div>
						</div>

						<div class="grid items-start gap-4 sm:grid-cols-12">
							<!-- Item Select (Svelecte) -->
							<div class="sm:col-span-5">
								<ItemSelect
									kind={item.kind}
									value={item.kind === 'product' ? item.productId : item.lensCatalogItemId}
									{products}
									{lensItems}
									label={item.kind === 'product' ? 'Producto *' : 'Lente *'}
									onselect={(id, price) => handleItemSelect(item, id, price)}
								/>
							</div>

							<!-- Quantity -->
							<div class="sm:col-span-1">
								<Label for="qty-{item.id}" class="mb-1.5 text-sm">Cant.</Label>
								<Input
									id="qty-{item.id}"
									type="number"
									bind:value={item.quantity}
									min="1"
									max={item.kind === 'product' && maxStock !== null && maxStock > 0
										? maxStock
										: undefined}
									class="font-mono {item.kind === 'product' &&
									maxStock !== null &&
									item.quantity > maxStock
										? 'border-red-500 ring-1 ring-red-500'
										: ''}"
								/>
								{#if item.kind === 'product' && maxStock !== null && item.quantity > maxStock}
									<p class="mt-0.5 text-xs text-red-500">Máx: {maxStock}</p>
								{/if}
							</div>

							<!-- Unit Price -->
							<div class="sm:col-span-2">
								<Label for="price-{item.id}" class="mb-1.5 text-sm">Precio ($)</Label>
								<Input
									id="price-{item.id}"
									type="number"
									bind:value={item.unitPrice}
									step="0.01"
									min="0"
									class="font-mono"
								/>
							</div>

							<!-- Item Discount -->
							<div class="sm:col-span-2">
								<Label for="disc-{item.id}" class="mb-1.5 text-sm">Descuento</Label>
								<div class="flex items-center gap-1">
									<Input
										id="disc-{item.id}"
										type="number"
										bind:value={item.discount}
										step="0.01"
										min="0"
										class="min-w-0 flex-1 font-mono"
									/>
									<Select bind:value={item.discountType} class="w-16 shrink-0">
										{#each ALL_DISCOUNT_TYPES as dt (dt)}
											<option value={dt}>{dt === 'FIXED' ? '$' : '%'}</option>
										{/each}
									</Select>
								</div>
							</div>

							<!-- Line Total -->
							<div class="sm:col-span-2">
								<div class="mb-1.5 text-sm">&nbsp;</div>
								<p
									class="flex h-[42px] items-center font-mono text-base font-semibold text-blue-700"
								>
									{formatPrice(itemLineTotal(item))}
								</p>
							</div>
						</div>

						<!-- Lens Info Bar: pricing unit + source badges -->
						{#if item.kind === 'lens' && item.lensCatalogItemId}
							{@const lens = getLensItem(item)}
							{@const match = getLensMatch(item)}
							<div class="mt-3 flex flex-wrap items-center gap-2">
								{#if lens}
									<!-- Source badge -->
									<span
										class="rounded-full px-3 py-1 text-sm font-semibold {lens.source === 'FINISHED'
											? 'bg-emerald-100 text-emerald-700'
											: 'bg-sky-100 text-sky-700'}"
									>
										{getLensSourceLabel(lens.source)}
									</span>
									<!-- Pricing unit badge -->
									<span
										class="rounded-full px-3 py-1 text-sm font-semibold {lens.pricingUnit === 'PAIR'
											? 'bg-violet-100 text-violet-700'
											: 'bg-slate-100 text-slate-600'}"
									>
										{getPricingUnitLabel(lens.pricingUnit)}
									</span>
									<!-- Lens type badge -->
									<span
										class="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700"
									>
										{getLensTypeLabel(lens.type)}
									</span>
									{#if lens.material}
										<span class="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
											{lens.material.name}
										</span>
									{/if}
								{/if}
							</div>

							<!-- Match Banner — prominent full-width indicator -->
							{#if match}
								{@const display = MATCH_DISPLAY[match.overall]}
								<div
									class="mt-3 flex items-center gap-3 rounded-lg border-2 px-4 py-3 {match.overall ===
									'full'
										? 'border-emerald-300 bg-emerald-50'
										: match.overall === 'partial'
											? 'border-amber-300 bg-amber-50'
											: 'border-red-300 bg-red-50'}"
								>
									{#if match.overall === 'full'}
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500"
										>
											<CheckCircle class="h-5 w-5 text-white" />
										</div>
									{:else if match.overall === 'partial'}
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500"
										>
											<AlertTriangle class="h-5 w-5 text-white" />
										</div>
									{:else}
										<div
											class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-500"
										>
											<XCircle class="h-5 w-5 text-white" />
										</div>
									{/if}
									<div class="flex-1">
										<p class="text-sm font-bold {display.color}">
											{display.label}
										</p>
										{#if match.overall === 'full'}
											<p class="text-xs text-emerald-600">
												La fórmula del paciente está dentro del rango de este lente.
											</p>
										{:else if match.overall === 'partial'}
											<p class="text-xs text-amber-700">Solo un ojo es compatible:</p>
											<div class="mt-1 flex items-center gap-3">
												<span
													class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold {match.od ===
													'full'
														? 'bg-emerald-100 text-emerald-700'
														: 'bg-red-100 text-red-700'}"
												>
													{#if match.od === 'full'}
														<CheckCircle class="h-3.5 w-3.5" />
													{:else}
														<XCircle class="h-3.5 w-3.5" />
													{/if}
													OD — {match.od === 'full' ? 'Compatible' : 'Fuera de rango'}
												</span>
												<span
													class="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold {match.os ===
													'full'
														? 'bg-emerald-100 text-emerald-700'
														: 'bg-red-100 text-red-700'}"
												>
													{#if match.os === 'full'}
														<CheckCircle class="h-3.5 w-3.5" />
													{:else}
														<XCircle class="h-3.5 w-3.5" />
													{/if}
													OS — {match.os === 'full' ? 'Compatible' : 'Fuera de rango'}
												</span>
											</div>
										{:else}
											<p class="text-xs text-red-600">
												La fórmula del paciente no es compatible con los rangos de este lente.
												Seleccione otro lente.
											</p>
										{/if}
									</div>
								</div>
							{/if}
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<!-- Step 2 Navigation -->
		<div class="mt-6 flex justify-between">
			<Button color="light" size="lg" onclick={prevStep}>
				<ChevronLeft class="mr-1 h-4 w-4" />
				Anterior
			</Button>
			<Button color="blue" size="lg" onclick={nextStep} disabled={!step2Valid}>
				Siguiente
				<ChevronRight class="ml-1 h-4 w-4" />
			</Button>
		</div>
	</div>

	<!-- ========================================================================
	     STEP 3: Resumen / Checkout
	     ======================================================================== -->
	<div class:hidden={currentStep !== 3}>
		<div class="space-y-6">
			<!-- Row 1: Customer + Sale Info side by side -->
			<div class="grid gap-5 lg:grid-cols-5">
				<!-- Customer Info — blue accent card (3/5 width) -->
				<div
					class="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/60 p-6 shadow-sm lg:col-span-3"
				>
					<div class="mb-3 flex items-center gap-2">
						<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500">
							<User class="h-4 w-4 text-white" />
						</div>
						<p class="text-sm font-bold tracking-widest text-blue-600 uppercase">Cliente</p>
					</div>
					{#if newCustomer}
						<p class="text-xl font-bold text-slate-900">
							{newCustomer.firstName}
							{newCustomer.lastName}
						</p>
						<p class="mt-1 font-mono text-base text-slate-500">{newCustomer.idNumber}</p>
						{#if newCustomer.primaryPhone}
							<p class="mt-1 text-base text-slate-600">Tel: {newCustomer.primaryPhone}</p>
						{/if}
						<div
							class="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700"
						>
							Nuevo cliente — será creado al registrar
						</div>
					{:else if selectedCustomer}
						<p class="text-xl font-bold text-slate-900">
							{selectedCustomer.firstName}
							{selectedCustomer.lastName}
						</p>
						<div class="mt-2 space-y-1 text-base text-slate-600">
							<p>
								Doc: <span class="font-mono font-semibold text-slate-700"
									>{selectedCustomer.idNumber}</span
								>
							</p>
							{#if selectedCustomer.primaryPhone}
								<p>Tel: <span class="font-medium">{selectedCustomer.primaryPhone}</span></p>
							{/if}
							{#if selectedCustomer.email}
								<p>{selectedCustomer.email}</p>
							{/if}
						</div>
					{:else if customerId}
						<p class="text-lg text-slate-700">Cliente seleccionado</p>
					{/if}
				</div>

				<!-- Sale Details — right column (2/5 width) -->
				<div class="flex flex-col gap-4 lg:col-span-2">
					<!-- Order + Date + Items — single merged card -->
					<div
						class="rounded-xl border border-blue-300 bg-gradient-to-br from-blue-500 to-blue-600 p-5 shadow-sm"
					>
						{#if nextOrderNumber}
							<div class="mb-4 flex items-center gap-2">
								<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20">
									<Hash class="h-3.5 w-3.5 text-white" />
								</div>
								<p class="text-xs font-bold tracking-widest text-blue-100 uppercase">Nº de Orden</p>
							</div>
							<p class="mb-4 font-mono text-3xl font-bold text-white">#{nextOrderNumber}</p>
						{/if}
						<div class="flex items-center gap-4 border-t border-white/20 pt-4">
							<div class="flex flex-1 items-center gap-2">
								<Calendar class="h-4 w-4 text-blue-200" />
								<div>
									<p class="text-xs text-blue-200">Fecha</p>
									<p class="font-mono text-sm font-semibold text-white">
										{dateToISODateString(saleDate)}
									</p>
								</div>
							</div>
							<div class="h-8 w-px bg-white/20"></div>
							<div class="flex flex-1 items-center gap-2">
								<ShoppingCart class="h-4 w-4 text-blue-200" />
								<div>
									<p class="text-xs text-blue-200">Artículos</p>
									<p class="font-mono text-sm font-semibold text-white">
										{items.length}
									</p>
								</div>
							</div>
						</div>
					</div>
					{#if notes}
						<div
							class="flex-1 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/60 p-5 shadow-sm"
						>
							<div class="mb-2 flex items-center gap-2">
								<div class="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500">
									<FileText class="h-3.5 w-3.5 text-white" />
								</div>
								<p class="text-xs font-bold tracking-widest text-amber-600 uppercase">Notas</p>
							</div>
							<p class="text-base text-slate-700">{notes}</p>
						</div>
					{/if}
				</div>
			</div>

			<!-- Row 2: Items Table (full width) -->
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<p class="mb-3 text-sm font-bold tracking-widest text-slate-500 uppercase">
					Detalle de Ítems
				</p>
				<div class="overflow-x-auto rounded-lg border border-slate-200">
					<table class="w-full text-left">
						<thead class="bg-slate-100 text-sm text-slate-600">
							<tr>
								<th class="px-4 py-3 font-semibold">Tipo</th>
								<th class="px-4 py-3 font-semibold">Producto / Lente</th>
								<th class="px-4 py-3 text-right font-semibold">Cant.</th>
								<th class="px-4 py-3 text-right font-semibold">P. Unit.</th>
								<th class="px-4 py-3 text-right font-semibold">Desc.</th>
								<th class="px-4 py-3 text-right font-semibold">Subtotal</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100">
							{#each items as item (item.id)}
								{@const productType = getItemProductType(item)}
								{@const rxMatch = getLensMatch(item)}
								<tr class="text-slate-700 hover:bg-slate-50/50">
									<td class="px-4 py-3">
										{#if item.kind === 'lens'}
											<span
												class="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700"
											>
												Lente
											</span>
										{:else if productType}
											{@const badgeColor = getProductTypeBadgeColor(productType)}
											<span
												class="rounded-full px-2.5 py-1 text-xs font-semibold
												{badgeColor === 'blue' ? 'bg-blue-100 text-blue-700' : ''}
												{badgeColor === 'green' ? 'bg-green-100 text-green-700' : ''}
												{badgeColor === 'purple' ? 'bg-purple-100 text-purple-700' : ''}
												{badgeColor === 'yellow' ? 'bg-amber-100 text-amber-700' : ''}
												{badgeColor === 'gray' ? 'bg-slate-100 text-slate-700' : ''}"
											>
												{getProductTypeLabel(productType)}
											</span>
										{:else}
											<span
												class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700"
											>
												Producto
											</span>
										{/if}
									</td>
									<td class="px-4 py-3">
										<p class="text-base font-medium">{getItemName(item)}</p>
										{#if item.kind === 'lens' && (prescriptionValues.odSphere || prescriptionValues.osSphere)}
											<div class="mt-1 flex items-center gap-3 text-xs text-slate-500">
												<span class="flex items-center gap-1">
													<Eye class="h-3 w-3 text-blue-400" />
													OD:
													<span class="font-mono font-medium text-slate-700"
														>{prescriptionValues.odSphere || '—'} / {prescriptionValues.odCylinder ||
															'—'}</span
													>
												</span>
												<span class="flex items-center gap-1">
													<Eye class="h-3 w-3 text-violet-400" />
													OS:
													<span class="font-mono font-medium text-slate-700"
														>{prescriptionValues.osSphere || '—'} / {prescriptionValues.osCylinder ||
															'—'}</span
													>
												</span>
												{#if rxMatch}
													{@const display = MATCH_DISPLAY[rxMatch.overall]}
													<span
														class="ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold {display.bgColor} {display.color}"
													>
														{display.label}
													</span>
												{/if}
											</div>
										{/if}
									</td>
									<td class="px-4 py-3 text-right font-mono text-base">{item.quantity}</td>
									<td class="px-4 py-3 text-right font-mono text-base"
										>{formatPrice(item.unitPrice)}</td
									>
									<td class="px-4 py-3 text-right font-mono text-base text-red-500">
										{#if item.discount > 0}
											-{item.discountType === 'PERCENTAGE'
												? `${item.discount}%`
												: formatPrice(item.discount)}
										{:else}
											—
										{/if}
									</td>
									<td class="px-4 py-3 text-right font-mono text-base font-semibold"
										>{formatPrice(itemLineTotal(item))}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Row 3: Discount + Total side by side -->
			<div class="grid gap-5 lg:grid-cols-2">
				<!-- Discount -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<p class="mb-4 text-sm font-bold tracking-widest text-slate-500 uppercase">Descuento</p>
					<div class="space-y-3">
						<div class="flex items-center justify-between gap-4 text-base">
							<span class="text-slate-600">Subtotal</span>
							<span class="font-mono font-semibold text-slate-800">{formatPrice(subtotal)}</span>
						</div>
						<div class="flex items-center justify-between gap-2 text-base">
							<span class="text-slate-600">Descuento General</span>
							<div class="flex items-center gap-1">
								<Input
									type="number"
									bind:value={discount}
									step="0.01"
									min="0"
									class="w-24 text-right font-mono"
								/>
								<Select bind:value={discountType} class="w-16">
									{#each ALL_DISCOUNT_TYPES as dt (dt)}
										<option value={dt}>{dt === 'FIXED' ? '$' : '%'}</option>
									{/each}
								</Select>
							</div>
						</div>
						{#if globalDiscountAmount > 0}
							<div class="flex justify-between text-base">
								<span class="text-slate-400">Descuento aplicado</span>
								<span class="font-mono font-semibold text-red-500"
									>-{formatPrice(globalDiscountAmount)}</span
								>
							</div>
						{/if}
					</div>
				</div>

				<!-- Total — big blue accent -->
				<div
					class="flex flex-col justify-center rounded-xl border border-blue-200 bg-gradient-to-br from-blue-600 to-blue-700 p-6 shadow-lg"
				>
					<p class="mb-2 text-sm font-bold tracking-widest text-blue-200 uppercase">
						Total a Pagar
					</p>
					<p class="font-mono text-4xl font-bold text-white">{formatPrice(total)}</p>
					<p class="mt-2 text-base text-blue-200">
						{items.length} artículo{items.length !== 1 ? 's' : ''}
					</p>
				</div>
			</div>
		</div>

		<!-- Step 3 Navigation -->
		<div class="mt-6 flex justify-between">
			<Button color="light" size="lg" onclick={prevStep}>
				<ChevronLeft class="mr-1 h-4 w-4" />
				Anterior
			</Button>
			<div class="flex gap-3">
				<Button color="light" size="lg" href={resolve('/sales')}>Cancelar</Button>
				<Button color="blue" size="lg" disabled={!canSubmit} onclick={handleSubmit}>
					{#if submitting}
						<Spinner size="4" class="mr-2" />
					{/if}
					<ShoppingCart class="mr-2 h-4 w-4" />
					Registrar Venta
				</Button>
			</div>
		</div>
	</div>
</div>
