<script lang="ts">
	import { untrack } from 'svelte';
	import { Button, Select, Input, Label } from 'flowbite-svelte';
	import {
		Plus,
		Trash2,
		ChevronLeft,
		ChevronRight,
		User,
		Hash,
		Eye
	} from '@lucide/svelte';
	import { formatPrice } from '$lib/utils';
	import { ALL_DISCOUNT_TYPES, DiscountType } from '$lib/shared/enums';
	import { getLensTypeLabel, getLensSourceLabel } from '$lib/shared/enums/lensTypes';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import {
		findProduct,
		findLensItem,
		computeItemDiscount as _computeDiscount,
		itemLineTotal as _lineTotal,
		getRequiredEyes,
		validatePrescriptionFields,
		hasPrescriptionErrors
	} from './saleItemHelpers';
	import type { PrescriptionFieldErrors } from './saleItemHelpers';
	import ItemSelect from './ItemSelect.svelte';
	import PrescriptionInput from './PrescriptionInput.svelte';
	import type { PrescriptionValues } from './PrescriptionInput.svelte';
	import type { Customer, Prescription } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from './newSaleTypes';
	import { createEmptyLensPair } from './newSaleTypes';

	interface Props {
		items: SaleItemRow[];
		prescriptionValues: PrescriptionValues;
		customerPrescription: Prescription | null;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		nextOrderNumber?: number;
		valid: boolean;
		onnext: () => void;
		onprev: () => void;
	}

	let {
		items = $bindable(),
		prescriptionValues = $bindable(),
		customerPrescription,
		selectedCustomer,
		newCustomer,
		products,
		lensItems,
		nextOrderNumber,
		valid,
		onnext,
		onprev
	}: Props = $props();

	// ============================================================================
	// ITEMS MANAGEMENT
	// ============================================================================

	const hasLensItem = $derived(items.some((i) => i.kind === 'lens'));

	function createEmptyItem(): SaleItemRow {
		return {
			id: crypto.randomUUID(),
			kind: 'product',
			productId: '',
			quantity: 1,
			lensPair: null,
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
		item.lensPair = null;
		item.unitPrice = 0;
	}

	function handleItemSelect(item: SaleItemRow, id: string, unitPrice: number) {
		if (item.kind === 'product') {
			item.productId = id;
			item.unitPrice = unitPrice;
		} else {
			if (!item.lensPair) {
				item.lensPair = createEmptyLensPair();
			}
			item.lensPair.catalogItemId = id;
			syncPrescription(item);
			recalcSuggestedPrice(item);
		}
	}

	// ============================================================================
	// PRESCRIPTION SYNC
	// ============================================================================

	function parseNullableNum(v: string): number | null {
		if (v === '') return null;
		const n = parseFloat(v);
		return isNaN(n) ? null : n;
	}

	function parseNumOrZero(v: string): number {
		return parseNullableNum(v) ?? 0;
	}

	function parseAddition(v: string): number | null {
		const n = parseNullableNum(v);
		// Addition of 0 means no addition in practice.
		if (n === null || n === 0) return null;
		return n;
	}

	function parseAxis(v: string, cylinder: number): number | null {
		// Axis is relevant only when cylinder is present.
		if (cylinder === 0) return null;
		return parseNullableNum(v);
	}

	/** Sync shared prescription form values into the lens pair */
	function syncPrescription(item: SaleItemRow) {
		if (item.kind !== 'lens' || !item.lensPair?.catalogItemId) return;

		const pair = item.lensPair;

		const odCylinder = parseNumOrZero(prescriptionValues.odCylinder);
		const oiCylinder = parseNumOrZero(prescriptionValues.oiCylinder);

		pair.od.prescription = {
			sphere: parseNumOrZero(prescriptionValues.odSphere),
			cylinder: odCylinder,
			axis: parseAxis(prescriptionValues.odAxis, odCylinder),
			addition: parseAddition(prescriptionValues.odAddition)
		};
		pair.oi.prescription = {
			sphere: parseNumOrZero(prescriptionValues.oiSphere),
			cylinder: oiCylinder,
			axis: parseAxis(prescriptionValues.oiAxis, oiCylinder),
			addition: parseAddition(prescriptionValues.oiAddition)
		};
	}

	// Re-evaluate all lens items when prescription changes
	$effect(() => {
		// Track only prescription value changes as dependencies
		void prescriptionValues.odSphere;
		void prescriptionValues.odCylinder;
		void prescriptionValues.odAxis;
		void prescriptionValues.odAddition;
		void prescriptionValues.oiSphere;
		void prescriptionValues.oiCylinder;
		void prescriptionValues.oiAxis;
		void prescriptionValues.oiAddition;
		void prescriptionValues.lensType;

		// Untrack items iteration + writes to avoid infinite re-trigger loop
		untrack(() => {
			for (const item of items) {
				if (item.kind === 'lens' && item.lensPair?.catalogItemId) {
					syncPrescription(item);
				}
			}
		});
	});

	// ============================================================================
	// HELPERS
	// ============================================================================

	function getProduct(item: SaleItemRow): ProductWithRelations | undefined {
		return findProduct(item, products);
	}

	function getLensForDisplay(item: SaleItemRow): LensCatalogItemWithRelations | undefined {
		return findLensItem(item, lensItems);
	}

	function getProductMaxStock(item: SaleItemRow): number | null {
		if (item.kind === 'product' && item.productId) {
			const p = products.find((pr) => pr.id === item.productId);
			return p?.stock ?? null;
		}
		return null;
	}

	function itemLineTotal(item: SaleItemRow): number {
		return _lineTotal(item);
	}

	// ============================================================================
	// PRESCRIPTION VALIDATION
	// ============================================================================

	const requiredEyes = $derived(getRequiredEyes(items));

	const rxErrors: PrescriptionFieldErrors = $derived(
		validatePrescriptionFields(prescriptionValues, requiredEyes.needsOd, requiredEyes.needsOi)
	);

	/** Only show Rx errors once the user has started filling in prescription fields */
	const anyRxFieldFilled = $derived(
		prescriptionValues.odSphere !== '' ||
			prescriptionValues.odCylinder !== '' ||
			prescriptionValues.odAxis !== '' ||
			prescriptionValues.odAddition !== '' ||
			prescriptionValues.oiSphere !== '' ||
			prescriptionValues.oiCylinder !== '' ||
			prescriptionValues.oiAxis !== '' ||
			prescriptionValues.oiAddition !== ''
	);

	const visibleRxErrors: PrescriptionFieldErrors = $derived(anyRxFieldFilled ? rxErrors : {});

	// ============================================================================
	// LENS COST HELPERS
	// ============================================================================

	function getEnabledEyeCount(item: SaleItemRow): number {
		if (!item.lensPair) return 0;
		return (item.lensPair.od.enabled ? 1 : 0) + (item.lensPair.oi.enabled ? 1 : 0);
	}

	/** Recalculate unitPrice to the suggested sale price for the full lens order */
	function recalcSuggestedPrice(item: SaleItemRow) {
		if (item.kind !== 'lens' || !item.lensPair) return;
		const lens = lensItems.find((l) => l.id === item.lensPair!.catalogItemId);
		if (!lens) return;

		const eyeCount = getEnabledEyeCount(item);
		if (eyeCount === 0) return;

		const totalCost =
			lens.basePrice * eyeCount + lens.mountingPrice + lens.shippingPrice;
		item.unitPrice = totalCost;
	}
</script>

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
			<span class="mx-1.5 text-slate-300">&middot;</span>
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
			errors={visibleRxErrors}
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
			{@const lens = item.kind === 'lens' ? getLensForDisplay(item) : undefined}
			{@const maxStock = item.kind === 'product' ? getProductMaxStock(item) : null}
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
					<!-- Item Select -->
					<div class="sm:col-span-5">
						<ItemSelect
							kind={item.kind}
							value={item.kind === 'product'
								? item.productId
								: (item.lensPair?.catalogItemId ?? '')}
							{products}
							{lensItems}
							label={item.kind === 'product' ? 'Producto *' : 'Lente *'}
							onselect={(id, price) => handleItemSelect(item, id, price)}
						/>
						{#if item.kind === 'product' && item.productId}
							{@const product = getProduct(item)}
							{#if product?.sku}
								<p class="mt-1 truncate font-mono text-xs text-slate-400">{product.sku}</p>
							{/if}
						{:else if item.kind === 'lens' && lens}
							<p class="mt-1 truncate text-xs text-violet-400">
								{getLensSourceLabel(lens.source)} &middot; {getLensTypeLabel(
									lens.type
								)}{#if lens.material}&nbsp;&middot; {lens.material.name}{/if}
							</p>
						{/if}
					</div>

					<!-- Quantity (products only) -->
					{#if item.kind === 'product'}
						<div class="sm:col-span-1">
							<Label for="qty-{item.id}" class="mb-1.5 text-sm">Cant.</Label>
							<Input
								id="qty-{item.id}"
								type="number"
								bind:value={item.quantity}
								min="1"
								max={maxStock !== null && maxStock > 0 ? maxStock : undefined}
								class="font-mono {maxStock !== null && item.quantity > maxStock
									? 'border-red-500 ring-1 ring-red-500'
									: ''}"
							/>
							{#if maxStock !== null && item.quantity > maxStock}
								<p class="mt-0.5 text-xs text-red-500">Máx: {maxStock}</p>
							{/if}
						</div>
					{/if}

					<!-- Unit Price -->
					<div class={item.kind === 'product' ? 'sm:col-span-2' : 'sm:col-span-3'}>
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
						<p class="flex h-[42px] items-center font-mono text-base font-semibold text-blue-700">
							{formatPrice(itemLineTotal(item))}
						</p>
					</div>
				</div>

				<!-- Lens-specific: eye toggles + cost breakdown -->
				{#if item.kind === 'lens' && item.lensPair?.catalogItemId}
					<!-- Eye Enable/Disable Toggle -->
					<div class="mt-4 flex items-center gap-4">
						<span class="text-sm font-medium text-slate-600">Ojos:</span>
						<label class="inline-flex cursor-pointer items-center gap-1.5">
							<input
								type="checkbox"
								bind:checked={item.lensPair.od.enabled}
							onchange={() => { syncPrescription(item); recalcSuggestedPrice(item); }}
								class="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
							/>
							<span
								class="text-sm font-semibold {item.lensPair.od.enabled
									? 'text-slate-700'
									: 'text-slate-400'}">OD</span
							>
						</label>
						<label class="inline-flex cursor-pointer items-center gap-1.5">
							<input
								type="checkbox"
								bind:checked={item.lensPair.oi.enabled}
							onchange={() => { syncPrescription(item); recalcSuggestedPrice(item); }}
								class="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
							/>
							<span
								class="text-sm font-semibold {item.lensPair.oi.enabled
									? 'text-slate-700'
									: 'text-slate-400'}">OI</span
							>
						</label>
						{#if !item.lensPair.od.enabled && !item.lensPair.oi.enabled}
							<span class="text-xs font-medium text-red-500">Debe habilitar al menos un ojo</span>
						{/if}
					</div>

					<!-- Lens cost breakdown -->
					{@const eyeCount = getEnabledEyeCount(item)}
					{#if eyeCount > 0 && lens}
						<div class="mt-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
							<p class="mb-1.5 text-xs font-semibold tracking-wide text-slate-400 uppercase">
								Desglose de Costo
							</p>
							<div class="space-y-0.5 text-xs text-slate-600">
								<div class="flex justify-between">
									<span>Cristales × {eyeCount}</span>
									<span class="font-mono">{formatPrice(lens.basePrice * eyeCount)}</span>
								</div>
								{#if lens.mountingPrice > 0}
									<div class="flex justify-between">
										<span>Montaje</span>
										<span class="font-mono">{formatPrice(lens.mountingPrice)}</span>
									</div>
								{/if}
								{#if lens.shippingPrice > 0}
									<div class="flex justify-between">
										<span>Envío</span>
										<span class="font-mono">{formatPrice(lens.shippingPrice)}</span>
									</div>
								{/if}
								<div
									class="flex justify-between border-t border-slate-200 pt-1 font-semibold text-slate-700"
								>
									<span>Costo total</span>
									<span class="font-mono">{formatPrice(lens.basePrice * eyeCount + lens.mountingPrice + lens.shippingPrice)}</span>
								</div>
							</div>
						</div>
					{/if}

					<!-- Lens info badges -->
					<div class="mt-3 flex flex-wrap items-center gap-2">
						{#if lens}
							<span class="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
								{getLensTypeLabel(lens.type)}
							</span>
							{#if lens.material}
								<span class="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">
									{lens.material.name}
								</span>
							{/if}
							{#if lens.supplier}
								<span class="text-sm text-slate-400">{lens.supplier.name}</span>
							{/if}
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>
</div>

<!-- Step 2 Navigation -->
<div class="mt-6 flex justify-between">
	<Button color="light" size="lg" onclick={onprev}>
		<ChevronLeft class="mr-1 h-4 w-4" />
		Anterior
	</Button>
	<Button color="blue" size="lg" onclick={onnext} disabled={!valid}>
		Siguiente
		<ChevronRight class="ml-1 h-4 w-4" />
	</Button>
</div>
