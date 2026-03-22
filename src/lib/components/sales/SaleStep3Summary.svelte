<script lang="ts">
	import { Button, Select, Input, Spinner } from 'flowbite-svelte';
	import {
		ShoppingCart,
		ChevronLeft,
		User,
		Calendar,
		FileText,
		Hash,
		Eye,
		Package
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import {
		formatPrice,
		dateToISODateString
	} from '$lib/utils';
	import type { CompatibilityVerdict } from '$lib/shared/matching/types';
	import {
		findProduct,
		findLensItem,
		computeItemDiscount,
		itemLineTotal,
		getItemVerdict,
		getItemName as _getItemName,
		VERDICT_DISPLAY
	} from './saleItemHelpers';
	import {
		ALL_DISCOUNT_TYPES,
		DiscountType,
		type DiscountType as DiscountTypeEnum
	} from '$lib/shared/enums';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import {
		ProductType,
		getProductTypeLabel,
		getProductTypeBadgeColor
	} from '$lib/shared/enums/productTypes';
	import { LensType, getLensSourceLabel, getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import { getProductTypeIcon } from '$lib/components/ui/productTypeIcons';
	import type { PrescriptionValues } from './PrescriptionInput.svelte';
	import type { Customer } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from './newSaleTypes';

	interface Props {
		items: SaleItemRow[];
		prescriptionValues: PrescriptionValues;
		customerId: string;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		saleDate: Date;
		discount: number;
		discountType: DiscountTypeEnum;
		notes: string;
		nextOrderNumber?: number;
		products: ProductWithRelations[];
		lensItems: LensCatalogItemWithRelations[];
		submitting: boolean;
		canSubmit: boolean;
		onprev: () => void;
		onsubmit: () => void;
	}

	let {
		items,
		prescriptionValues,
		customerId,
		selectedCustomer,
		newCustomer,
		saleDate,
		discount = $bindable(),
		discountType = $bindable(),
		notes,
		nextOrderNumber,
		products,
		lensItems,
		submitting,
		canSubmit,
		onprev,
		onsubmit
	}: Props = $props();

	// ============================================================================
	// DERIVED TOTALS
	// ============================================================================

	const subtotal = $derived(items.reduce((acc, item) => acc + itemLineTotal(item), 0));

	const globalDiscountAmount = $derived(
		discountType === DiscountType.PERCENTAGE ? (discount / 100) * subtotal : discount
	);

	const total = $derived(Math.max(0, subtotal - globalDiscountAmount));

	// ============================================================================
	// HELPERS
	// ============================================================================

	function getProduct(item: SaleItemRow): ProductWithRelations | undefined {
		return findProduct(item, products);
	}

	function getLensItem(item: SaleItemRow): LensCatalogItemWithRelations | undefined {
		return findLensItem(item, lensItems);
	}

	function getItemName(item: SaleItemRow): string {
		return _getItemName(item, products, lensItems);
	}

	function getItemProductType(item: SaleItemRow): string | null {
		const p = getProduct(item);
		return p?.type ?? null;
	}

	function getOverallVerdict(item: SaleItemRow): CompatibilityVerdict | null {
		return getItemVerdict(item);
	}
</script>

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
		<p class="mb-3 text-sm font-bold tracking-widest text-slate-500 uppercase">Detalle de Ítems</p>
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
					{@const verdict = getOverallVerdict(item)}
						<tr class="text-slate-700 hover:bg-slate-50/50">
							<td class="px-4 py-3">
								{#if item.kind === 'lens'}
									<span
										class="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700"
									>
										<Eye class="h-3 w-3" />
										Lente
									</span>
								{:else if productType}
									{@const badgeColor = getProductTypeBadgeColor(productType)}
									{@const Icon = getProductTypeIcon(productType)}
									<span
										class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold
										{badgeColor === 'blue' ? 'bg-blue-100 text-blue-700' : ''}
										{badgeColor === 'green' ? 'bg-green-100 text-green-700' : ''}
										{badgeColor === 'purple' ? 'bg-purple-100 text-purple-700' : ''}
										{badgeColor === 'yellow' ? 'bg-amber-100 text-amber-700' : ''}
										{badgeColor === 'gray' ? 'bg-slate-100 text-slate-700' : ''}"
									>
										<Icon class="h-3 w-3" />
										{getProductTypeLabel(productType)}
									</span>
								{:else}
									<span
										class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700"
									>
										<Package class="h-3 w-3" />
										Producto
									</span>
								{/if}
							</td>
							<td class="px-4 py-3">
								<p class="text-base font-medium">{getItemName(item)}</p>
								{#if item.kind === 'product'}
									{@const product = getProduct(item)}
									{#if product}
										<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
											{#if product.sku}
												<span class="font-mono text-slate-400">{product.sku}</span>
											{/if}
											{#if product.brand}
												<span class="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600"
													>{product.brand.name}</span
												>
											{/if}
										</div>
									{/if}
								{:else}
									{@const lens = getLensItem(item)}
									<!-- Lens badges row -->
									<div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
										{#if lens}
											<span
												class="rounded px-1.5 py-0.5 font-medium {lens.source === 'FINISHED'
													? 'bg-emerald-50 text-emerald-600'
													: 'bg-sky-50 text-sky-600'}">{getLensSourceLabel(lens.source)}</span
											>
											<span class="rounded bg-blue-50 px-1.5 py-0.5 font-medium text-blue-600"
												>{getLensTypeLabel(lens.type)}</span
											>
											{#if lens.material}
												<span class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-500"
													>{lens.material.name}</span
												>
											{/if}
											{#if lens.supplier}
												<span class="text-slate-400">&middot; {lens.supplier.name}</span>
											{/if}
										{/if}
									</div>
									<!-- Prescription row — visually separated -->
									{#if prescriptionValues.odSphere || prescriptionValues.oiSphere}
										{@const showAddition =
											prescriptionValues.lensType !== LensType.MONOFOCAL &&
											lens?.type !== LensType.MONOFOCAL}
										<div
											class="mt-2 inline-grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
										>
											<!-- OD row -->
											<span class="flex items-center gap-1 font-semibold text-blue-600">
												<Eye class="h-3.5 w-3.5 text-blue-500" />
												OD
											</span>
											<span class="flex items-center gap-1.5 font-mono font-medium text-slate-800">
												{prescriptionValues.odSphere || '—'}
												<span class="text-slate-400">/</span>
												{prescriptionValues.odCylinder || '—'}
												{#if prescriptionValues.odAxis}
													<span class="text-slate-400">x</span>
													{prescriptionValues.odAxis}°
												{/if}
												{#if prescriptionValues.odAddition && showAddition}
													<span class="text-slate-400">Add</span>
													{prescriptionValues.odAddition}
												{/if}
											</span>
												<!-- OI row -->
												<span class="flex items-center gap-1 font-semibold text-violet-600">
													<Eye class="h-3.5 w-3.5 text-violet-500" />
													OI
												</span>
												<span class="flex items-center gap-1.5 font-mono font-medium text-slate-800">
													{prescriptionValues.oiSphere || '—'}
													<span class="text-slate-400">/</span>
													{prescriptionValues.oiCylinder || '—'}
													{#if prescriptionValues.oiAxis}
														<span class="text-slate-400">x</span>
														{prescriptionValues.oiAxis}°
													{/if}
													{#if prescriptionValues.oiAddition && showAddition}
														<span class="text-slate-400">Add</span>
														{prescriptionValues.oiAddition}
												{/if}
												{#if verdict}
													{@const display = VERDICT_DISPLAY[verdict]}
													<span
														class="ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold {display.badgeBgColor} {display.textColor}"
													>
														{display.label}
													</span>
												{/if}
											</span>
										</div>
									{/if}
								{/if}
							</td>
							<td class="px-4 py-3 text-right font-mono text-base">{item.quantity}</td>
							<td class="px-4 py-3 text-right font-mono text-base">{formatPrice(item.unitPrice)}</td
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
			<p class="mb-2 text-sm font-bold tracking-widest text-blue-200 uppercase">Total a Pagar</p>
			<p class="font-mono text-4xl font-bold text-white">{formatPrice(total)}</p>
			<p class="mt-2 text-base text-blue-200">
				{items.length} artículo{items.length !== 1 ? 's' : ''}
			</p>
		</div>
	</div>
</div>

<!-- Step 3 Navigation -->
<div class="mt-6 flex justify-between">
	<Button color="light" size="lg" onclick={onprev}>
		<ChevronLeft class="mr-1 h-4 w-4" />
		Anterior
	</Button>
	<div class="flex gap-3">
		<Button color="light" size="lg" href={resolve('/sales')}>Cancelar</Button>
		<Button color="blue" size="lg" disabled={!canSubmit} onclick={onsubmit}>
			{#if submitting}
				<Spinner size="4" class="mr-2" />
			{/if}
			<ShoppingCart class="mr-2 h-4 w-4" />
			Registrar Venta
		</Button>
	</div>
</div>
