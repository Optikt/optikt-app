<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { Button, Select, Input, Spinner } from 'flowbite-svelte';
	import {
		ShoppingCart,
		ChevronLeft,
		User,
		Calendar,
		FileText,
		Hash,
		Eye,
		Package,
		AlertTriangle
	} from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { formatPrice, dateToISODateString } from '$lib/utils';
	import {
		findProduct,
		computeItemDiscount,
		itemLineTotal,
		getItemName as _getItemName
	} from './saleItemHelpers';
	import {
		ALL_DISCOUNT_TYPES,
		DiscountType,
		type DiscountType as DiscountTypeEnum
	} from '$lib/shared/enums';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import {
		getProductTypeLabel,
		getProductTypeBadgeColor
	} from '$lib/shared/enums/productTypes';
	import { getProductTypeIcon } from '$lib/components/ui/productTypeIcons';
	import type { Customer } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from './newSaleTypes';
	import type { FulfillmentPlanResult, CatalogItemForPlanning } from '$lib/shared/planning';
	import FulfillmentPlanPanel from './FulfillmentPlanPanel.svelte';

	interface Props {
		items: SaleItemRow[];
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
		planResult: FulfillmentPlanResult | null;
		catalogMap: Map<string, CatalogItemForPlanning>;
		submitting: boolean;
		canSubmit: boolean;
		onprev: () => void;
		onsubmit: () => void;
	}

	let {
		items,
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
		planResult,
		catalogMap,
		submitting,
		canSubmit,
		onprev,
		onsubmit
	}: Props = $props();

	// ============================================================================
	// CONFIRMATION STATE
	// ============================================================================

	/** Track which plan lines the user has confirmed */
	let confirmedLines = new SvelteSet<string>();
	let surplusAcknowledged = $state(false);

	function toggleConfirm(requirementId: string) {
		if (confirmedLines.has(requirementId)) confirmedLines.delete(requirementId);
		else confirmedLines.add(requirementId);
	}

	/** Lines that require confirmation */
	const linesNeedingConfirmation = $derived(
		planResult?.lines.filter((l) => l.requiresConfirmation) ?? []
	);

	/** All confirmations acknowledged? */
	const allConfirmed = $derived(
		linesNeedingConfirmation.length === 0 ||
			linesNeedingConfirmation.every((l) => confirmedLines.has(l.requirementId))
	);

	const surplusItems = $derived(planResult?.surplus ?? []);
	const surplusUnitsTotal = $derived(surplusItems.reduce((sum, item) => sum + item.surplusUnits, 0));
	const hasSurplusToAcknowledge = $derived(surplusItems.length > 0);
	const hasUndefinedSurplusRx = $derived(
		surplusItems.some((item) => item.predeterminedPrescription === null)
	);

	// ============================================================================
	// DERIVED TOTALS
	// ============================================================================

	const hasLensItems = $derived(items.some((i) => i.kind === 'lens'));

	const subtotal = $derived(items.reduce((acc, item) => acc + itemLineTotal(item), 0));

	const globalDiscountAmount = $derived(
		discountType === DiscountType.PERCENTAGE ? (discount / 100) * subtotal : discount
	);

	const total = $derived(Math.max(0, subtotal - globalDiscountAmount));

	/** Can submit? All confirmations + surplus acknowledgement + parent canSubmit */
	const canSubmitFinal = $derived(
		canSubmit && allConfirmed && (!hasSurplusToAcknowledge || surplusAcknowledged)
	);

	// ============================================================================
	// HELPERS
	// ============================================================================

	function getProduct(item: SaleItemRow): ProductWithRelations | undefined {
		return findProduct(item, products);
	}

	function getItemName(item: SaleItemRow): string {
		return _getItemName(item, products, lensItems);
	}

	function getItemProductType(item: SaleItemRow): string | null {
		const p = getProduct(item);
		return p?.type ?? null;
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

	<!-- Row 2: All Items Table (products + lenses unified) -->
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
								{#if item.kind === 'product' && getProduct(item)}
									{@const product = getProduct(item)!}
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

	<!-- Row 3: Fulfillment Plan — logistics only (only if there are lens items) -->
	{#if hasLensItems && planResult}
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<p class="mb-3 text-sm font-bold tracking-widest text-slate-500 uppercase">
				Plan de Cumplimiento
			</p>
			<FulfillmentPlanPanel plan={planResult} catalog={catalogMap} />

			<!-- Confirmation Checkboxes -->
			{#if linesNeedingConfirmation.length > 0}
				<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
					<div class="mb-3 flex items-center gap-2">
						<AlertTriangle class="h-4 w-4 text-amber-600" />
						<span class="text-sm font-semibold text-amber-800">
							Confirmaciones requeridas
						</span>
					</div>
					<div class="space-y-2">
						{#each linesNeedingConfirmation as line (line.requirementId)}
							{@const catalogName = catalogMap.get(line.catalogItemId)?.name ?? '—'}
							<label class="flex items-start gap-3 cursor-pointer">
								<input
									type="checkbox"
									checked={confirmedLines.has(line.requirementId)}
									onchange={() => toggleConfirm(line.requirementId)}
									class="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
								/>
								<span class="text-sm text-amber-800">
									Confirmo con el proveedor el pedido por unidad de <span class="font-semibold"
										>{catalogName}</span
									>
									({line.eye === 'OD' ? 'OD' : 'OI'})
								</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}

			{#if hasSurplusToAcknowledge}
				<div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
					<div class="mb-3 flex items-center gap-2">
						<AlertTriangle class="h-4 w-4 text-amber-600" />
						<span class="text-sm font-semibold text-amber-800">
							Confirmación de excedente
						</span>
					</div>
					<p class="mb-3 text-sm text-amber-800">
						Esta venta generará <span class="font-semibold">{surplusUnitsTotal} unidad(es) de excedente</span>
						que quedarán en stock.
						{#if hasUndefinedSurplusRx}
							 Parte de ese excedente quedará con <span class="font-semibold">Rx a definir</span>
							al momento de hacer el pedido.
						{/if}
					</p>
					<label class="flex items-start gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={surplusAcknowledged}
							class="mt-0.5 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
						/>
						<span class="text-sm text-amber-800">
							Confirmo que entiendo y acepto el excedente que esta venta dejará en stock
						</span>
					</label>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Row 4: Discount + Total side by side -->
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
		<Button color="blue" size="lg" disabled={!canSubmitFinal} onclick={onsubmit}>
			{#if submitting}
				<Spinner size="4" class="mr-2" />
			{/if}
			<ShoppingCart class="mr-2 h-4 w-4" />
			Registrar Venta
		</Button>
	</div>
</div>
