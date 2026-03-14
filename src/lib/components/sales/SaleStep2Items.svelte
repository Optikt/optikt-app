<script lang="ts">
	import { Button, Select, Input, Label } from 'flowbite-svelte';
	import {
		Plus,
		Trash2,
		ChevronLeft,
		ChevronRight,
		User,
		Hash,
		CheckCircle,
		AlertTriangle,
		XCircle,
		Eye
	} from '@lucide/svelte';
	import { formatPrice, checkLensMatch, hasPrescriptionData, MATCH_DISPLAY } from '$lib/utils';
	import type { PrescriptionForMatching } from '$lib/utils/lensMatching';
	import {
		ALL_DISCOUNT_TYPES,
		DiscountType,
		type DiscountType as DiscountTypeEnum
	} from '$lib/shared/enums';
	import {
		getLensTypeLabel,
		getLensSourceLabel,
		getPricingUnitLabel
	} from '$lib/shared/enums/lensTypes';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import ItemSelect from './ItemSelect.svelte';
	import PrescriptionInput from './PrescriptionInput.svelte';
	import type { PrescriptionValues } from './PrescriptionInput.svelte';
	import type { Customer, Prescription } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from './newSaleTypes';

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

	function getLensMatch(item: SaleItemRow) {
		if (item.kind !== 'lens' || !item.lensCatalogItemId) return null;
		const lens = lensItems.find((l) => l.id === item.lensCatalogItemId);
		if (!lens) return null;
		const rx = buildRxForMatching();
		if (!hasPrescriptionData(rx)) return null;
		return checkLensMatch(lens.ranges, rx);
	}

	function getLensItem(item: SaleItemRow): LensCatalogItemWithRelations | undefined {
		return lensItems.find((l) => l.id === item.lensCatalogItemId);
	}

	// ============================================================================
	// HELPERS
	// ============================================================================

	function getProduct(item: SaleItemRow): ProductWithRelations | undefined {
		if (item.kind === 'product' && item.productId) {
			return products.find((p) => p.id === item.productId);
		}
		return undefined;
	}

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
						{#if item.kind === 'product' && item.productId}
							{@const product = getProduct(item)}
							{#if product?.sku}
								<p class="mt-1 truncate font-mono text-xs text-slate-400">{product.sku}</p>
							{/if}
						{:else if item.kind === 'lens' && item.lensCatalogItemId}
							{@const lens = getLensItem(item)}
							{#if lens}
								<p class="mt-1 truncate text-xs text-violet-400">
									{getLensSourceLabel(lens.source)} &middot; {getLensTypeLabel(
										lens.type
									)}{#if lens.material}
										&middot; {lens.material.name}{/if}
								</p>
							{/if}
						{/if}
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
						<p class="flex h-[42px] items-center font-mono text-base font-semibold text-blue-700">
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
							<span class="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
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
	<Button color="light" size="lg" onclick={onprev}>
		<ChevronLeft class="mr-1 h-4 w-4" />
		Anterior
	</Button>
	<Button color="blue" size="lg" onclick={onnext} disabled={!valid}>
		Siguiente
		<ChevronRight class="ml-1 h-4 w-4" />
	</Button>
</div>
