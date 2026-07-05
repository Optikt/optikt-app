<script lang="ts">
	import {
		Calendar,
		Eye,
		FileText,
		Hash,
		Package,
		ReceiptText,
		ShoppingCart,
		User
	} from '@lucide/svelte';
	import { formatPrice, getDiscountValueMax, isDiscountValueValid } from '$lib/utils';
	import {
		calculateSaleSummarySubtotal,
		buildTaxItemsFromWizard,
		findLensItem,
		findProduct,
		getEnabledEyeCount,
		getItemDiscountBase,
		getItemDiscountMax,
		getItemName as _getItemName,
		isItemDiscountValid,
		itemLineTotal
	} from '../saleItemHelpers';
	import {
		DiscountType,
		getTreatmentCategoryLabel,
		type DiscountType as DiscountTypeEnum
	} from '$lib/shared/enums';
	import { getLensSourceLabel, getLensTypeLabel } from '$lib/shared/enums/lensTypes';
	import { getProductTypeLabel } from '$lib/shared/enums/productTypes';
	import { getProductTypeIcon } from '$lib/components/ui/productTypeIcons';
	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { Customer } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData, SelectedTreatment } from '../newSaleTypes';
	import SaleWizardFloatingActions from '../SaleWizardFloatingActions.svelte';
	import { getContext } from 'svelte';
	import { CATALOG_KEY, type CatalogData } from '../wizardContext';
	import {
		decomposePrice,
		DEFAULT_TAX_RATE,
		type TaxBreakdown,
		type TaxableItem
	} from '$lib/shared/tax';

	interface Props {
		items: SaleItemRow[];
		customerId?: string;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		saleDate: Date;
		secondaryContextDate?: Date | null;
		secondaryContextLabel?: string;
		discount: number;
		discountType: DiscountTypeEnum;
		notes: string;
		nextOrderNumber?: number;
		defaultTaxRate?: number;
		entityLabel?: string;
		entityValue?: string;
		customerFallbackName?: string;
		customerFallbackDocument?: string;
		submittingStatusLabel?: string;
		readyStatusLabel?: string;
		pendingStatusLabel?: string;
		adjustmentsEyebrow?: string;
		adjustmentsTitle?: string;
		totalCardEyebrow?: string;
		primaryLabel?: string;
		cancelLabel?: string;
		onCancel?: () => void;
		submitting: boolean;
		canSubmit: boolean;
		onprev: () => void;
		onsubmit: () => void;
	}

	interface TaxDisplayMeta {
		label: string;
		className: string;
	}

	let {
		items,
		customerId = '',
		selectedCustomer,
		newCustomer,
		saleDate,
		secondaryContextDate = null,
		secondaryContextLabel,
		discount = $bindable(),
		discountType = $bindable(),
		notes = $bindable(),
		nextOrderNumber,
		defaultTaxRate = DEFAULT_TAX_RATE,
		entityLabel = 'Orden',
		entityValue,
		customerFallbackName = 'Venta sin cliente',
		customerFallbackDocument = 'Sin documento',
		submittingStatusLabel = 'Registrando venta',
		readyStatusLabel = 'Revision final',
		pendingStatusLabel = 'Ajustes pendientes',
		adjustmentsEyebrow = 'Ajustes globales',
		adjustmentsTitle = 'Cierre comercial',
		totalCardEyebrow = 'Total neto a pagar',
		primaryLabel = 'Confirmar y Registrar Venta',
		cancelLabel = 'Cancelar',
		onCancel,
		submitting,
		canSubmit,
		onprev,
		onsubmit
	}: Props = $props();

	const { products, lensItems } = getContext<CatalogData>(CATALOG_KEY);

	const subtotal = $derived(calculateSaleSummarySubtotal(items));

	const rawGlobalDiscountAmount = $derived(
		discountType === DiscountType.PERCENTAGE ? (discount / 100) * subtotal : discount
	);

	const appliedGlobalDiscount = $derived(Math.min(Math.max(rawGlobalDiscountAmount, 0), subtotal));

	const total = $derived(Math.max(0, subtotal - appliedGlobalDiscount));

	const globalDiscountMax = $derived(getDiscountValueMax(discountType, subtotal));

	const hasInvalidGlobalDiscount = $derived(
		!isDiscountValueValid(discount, discountType, subtotal)
	);

	const canSubmitFinal = $derived(canSubmit && !hasInvalidGlobalDiscount);

	const taxItems = $derived(buildTaxItemsFromWizard(items, products, lensItems, defaultTaxRate));

	const adjustedTaxBreakdown = $derived.by(() =>
		computeAdjustedTaxBreakdown(taxItems, appliedGlobalDiscount)
	);

	const taxableRates = $derived.by(() =>
		Array.from(
			new Set(
				taxItems.filter((item) => item.isTaxable && item.taxRate > 0).map((item) => item.taxRate)
			)
		)
	);

	const taxSummaryLabel = $derived.by(() => {
		if (taxableRates.length === 1) {
			return `IVA (${formatTaxRate(taxableRates[0])}%)`;
		}
		return 'IVA';
	});

	const statusMeta = $derived.by(() => {
		if (submitting) {
			return {
				label: submittingStatusLabel,
				className: 'bg-brand-blue/10 text-brand-blue'
			};
		}

		if (canSubmitFinal) {
			return {
				label: readyStatusLabel,
				className: 'bg-warning-container text-on-warning-container'
			};
		}

		return {
			label: pendingStatusLabel,
			className: 'bg-error-container text-on-error-container'
		};
	});

	const displayCustomerName = $derived.by(() => {
		if (newCustomer?.firstName || newCustomer?.lastName) {
			return `${newCustomer.firstName} ${newCustomer.lastName}`.trim();
		}

		if (selectedCustomer) {
			return `${selectedCustomer.firstName} ${selectedCustomer.lastName}`.trim();
		}

		if (customerId) return 'Cliente asociado';
		return customerFallbackName;
	});

	const displayCustomerDocument = $derived.by(() => {
		if (newCustomer?.idNumber) return newCustomer.idNumber;
		if (selectedCustomer?.idNumber) return selectedCustomer.idNumber;
		return customerFallbackDocument;
	});

	const displaySaleDate = $derived.by(() => formatDisplayDate(saleDate));

	const displaySecondaryContextDate = $derived.by(() =>
		secondaryContextDate ? formatDisplayDate(secondaryContextDate) : null
	);

	const displayEntityValue = $derived.by(() => entityValue ?? `#${nextOrderNumber ?? 'Pendiente'}`);

	const totalRenderedRows = $derived.by(() =>
		items.reduce((count, item) => count + 1 + item.treatments.length, 0)
	);

	function getProduct(item: SaleItemRow): ProductWithRelations | undefined {
		return findProduct(item, products);
	}

	function getLens(item: SaleItemRow): LensCatalogItemWithRelations | undefined {
		return findLensItem(item, lensItems);
	}

	function getItemName(item: SaleItemRow): string {
		return _getItemName(item, products, lensItems);
	}

	function getItemProductType(item: SaleItemRow): string | null {
		return getProduct(item)?.type ?? null;
	}

	function formatDisplayDate(date: Date): string {
		return new Intl.DateTimeFormat('es-VE', {
			day: '2-digit',
			month: 'short',
			year: 'numeric'
		}).format(date);
	}

	function formatTaxRate(rate: number): string {
		return Number.isInteger(rate) ? String(rate) : rate.toFixed(2);
	}

	function getTaxMeta(isTaxable: boolean, taxRate: number): TaxDisplayMeta {
		if (isTaxable && taxRate > 0) {
			return {
				label: `IVA ${formatTaxRate(taxRate)}%`,
				className: 'bg-success-container text-on-success-container'
			};
		}

		return {
			label: 'Exento',
			className: 'bg-surface-container-high text-on-surface-variant'
		};
	}

	function getItemTaxMeta(item: SaleItemRow): TaxDisplayMeta {
		if (item.kind === 'product') {
			const product = getProduct(item);
			return getTaxMeta(product?.isTaxable ?? true, defaultTaxRate);
		}

		const lens = getLens(item);
		return getTaxMeta(lens?.isTaxable ?? false, defaultTaxRate);
	}

	function getTreatmentTaxMeta(treatment: SelectedTreatment): TaxDisplayMeta {
		return getTaxMeta(treatment.isTaxable, defaultTaxRate);
	}

	function getDiscountToggleButtonClass(isActive: boolean): string {
		return isActive
			? 'bg-brand-navy text-white shadow-sm'
			: 'text-on-surface-variant hover:bg-surface-container-high';
	}

	function computeAdjustedTaxBreakdown(
		itemsForTax: TaxableItem[],
		globalDiscountValue: number
	): TaxBreakdown {
		const subtotalBeforeGlobal = itemsForTax.reduce((sum, item) => {
			const gross = item.unitPrice * item.quantity;
			const lineDiscount =
				item.discountType === DiscountType.PERCENTAGE
					? gross * (item.discount / 100)
					: item.discount;
			return sum + Math.max(0, gross - lineDiscount);
		}, 0);

		const discountRatio =
			subtotalBeforeGlobal > 0
				? Math.min(Math.max(globalDiscountValue, 0), subtotalBeforeGlobal) / subtotalBeforeGlobal
				: 0;

		let taxableBase = 0;
		let exemptTotal = 0;
		let taxAmount = 0;

		for (const item of itemsForTax) {
			const gross = item.unitPrice * item.quantity;
			const lineDiscount =
				item.discountType === DiscountType.PERCENTAGE
					? gross * (item.discount / 100)
					: item.discount;
			const lineAfterLocalDiscount = Math.max(0, gross - lineDiscount);
			const adjustedLineTotal = lineAfterLocalDiscount * (1 - discountRatio);

			if (item.isTaxable && item.taxRate > 0) {
				const { base, tax } = decomposePrice(adjustedLineTotal, item.taxRate);
				taxableBase += base;
				taxAmount += tax;
			} else {
				exemptTotal += adjustedLineTotal;
			}
		}

		return {
			taxableBase,
			exemptTotal,
			taxAmount,
			total: taxableBase + exemptTotal + taxAmount
		};
	}
</script>

<div class="space-y-4">
	<section class="rounded-[1.5rem] bg-surface-container-lowest px-6 py-5 shadow-sm sm:px-7">
		<div class="flex flex-col gap-4 xl:flex-row xl:items-center xl:gap-5">
			<div class="shrink-0 xl:pr-2">
				<p class="text-[12px] font-semibold tracking-[0.24em] text-brand-blue uppercase">
					Paso 3 - Confirmacion
				</p>
			</div>

			<div
				class="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:flex-wrap xl:flex-nowrap xl:items-center"
			>
				<div
					class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant"
				>
					<Hash class="h-4 w-4 text-brand-blue" />
					<span>{entityLabel}</span>
					<span class="font-mono font-semibold text-brand-navy">{displayEntityValue}</span>
				</div>

				<div
					class="inline-flex min-w-0 flex-1 items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant"
				>
					<User class="h-4 w-4 shrink-0 text-brand-blue" />
					<span class="truncate font-medium text-brand-navy">{displayCustomerName}</span>
					<span class="shrink-0 font-mono text-xs text-outline">({displayCustomerDocument})</span>
				</div>

				<div
					class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant xl:ml-auto"
				>
					<Calendar class="h-4 w-4 text-brand-blue" />
					<span>{displaySaleDate}</span>
				</div>

				{#if displaySecondaryContextDate && secondaryContextLabel}
					<div
						class="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant"
					>
						<Calendar class="h-4 w-4 text-brand-blue" />
						<span class="text-outline">{secondaryContextLabel}</span>
						<span class="font-medium text-brand-navy">{displaySecondaryContextDate}</span>
					</div>
				{/if}
			</div>

			<div
				class="inline-flex shrink-0 items-center gap-2 rounded-full border border-current/10 px-4 py-2 text-[11px] font-semibold tracking-[0.18em] uppercase {statusMeta.className}"
			>
				<span class="h-2 w-2 rounded-full bg-current opacity-70"></span>
				<span>{statusMeta.label}</span>
			</div>
		</div>

		<div class="mt-4 border-t border-outline-variant/10 pt-4">
			<div class="flex items-start gap-3 rounded-xl bg-surface-container-low px-4 py-3">
				<FileText class="mt-1 h-4 w-4 shrink-0 text-brand-blue" />
				<div class="min-w-0 flex-1">
					<p class="text-[10px] font-semibold tracking-[0.14em] text-brand-blue uppercase">
						Nota de la venta
					</p>
					<textarea
						bind:value={notes}
						rows={2}
						placeholder="Observaciones, acuerdos o contexto para el equipo..."
						class="mt-1.5 w-full resize-none rounded-lg border-none bg-surface-container-highest px-3 py-2 text-sm text-on-surface placeholder:text-slate-400 focus:ring-1 focus:ring-brand-blue"
					></textarea>
				</div>
			</div>
		</div>
	</section>

	<section class="overflow-hidden rounded-[1.5rem] bg-surface-container-lowest shadow-sm">
		<div class="overflow-x-auto">
			<table class="min-w-full border-separate border-spacing-0">
				<thead>
					<tr class="border-b border-outline-variant bg-surface-container-high text-left">
						<th
							class="px-6 py-3.5 text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
							>Descripcion del item</th
						>
						<th
							class="px-4 py-3.5 text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
							>Cant.</th
						>
						<th
							class="px-4 py-3.5 text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
							>P. Unitario</th
						>
						<th
							class="px-4 py-3.5 text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
							>Impuesto</th
						>
						<th
							class="px-4 py-3.5 text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
							>Descuento</th
						>
						<th
							class="px-6 py-3.5 text-right text-xs font-semibold tracking-wide text-on-surface-variant uppercase"
							>Subtotal</th
						>
					</tr>
				</thead>

				<tbody class="bg-surface-container-lowest text-on-surface">
					{#each items as item, itemIndex (item.id)}
						{@const product = item.kind === 'product' ? getProduct(item) : undefined}
						{@const lens = item.kind === 'lens' ? getLens(item) : undefined}
						{@const productType = item.kind === 'product' ? getItemProductType(item) : null}
						{@const itemTaxMeta = getItemTaxMeta(item)}
						<tr class={itemIndex > 0 ? 'bg-surface-container-low/30' : ''}>
							<td class="px-6 py-5">
								<div class="flex items-center gap-4">
									<div
										class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl {item.kind ===
										'lens'
											? 'bg-brand-gold/15 text-brand-navy'
											: 'bg-brand-blue/10 text-brand-blue'}"
									>
										{#if item.kind === 'lens'}
											<Eye class="h-5 w-5" />
										{:else if productType}
											{@const ProductIcon = getProductTypeIcon(productType)}
											<ProductIcon class="h-5 w-5" />
										{:else}
											<Package class="h-5 w-5" />
										{/if}
									</div>

									<div class="min-w-0">
										{#if item.kind === 'product'}
											<p
												class="text-[10px] font-semibold tracking-[0.16em] text-brand-blue uppercase"
											>
												{productType ? getProductTypeLabel(productType) : 'Producto'}
											</p>
										{:else}
											<p
												class="text-[10px] font-semibold tracking-[0.16em] text-brand-blue uppercase"
											>
												Lente
											</p>
										{/if}

										<p class="text-sm font-semibold text-brand-navy sm:text-base">
											{getItemName(item)}
										</p>

										<div
											class="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant"
										>
											{#if item.kind === 'product'}
												{#if product?.sku}
													<span class="font-mono">Ref: {product.sku}</span>
												{/if}
												{#if product?.brand}
													<span>{product.sku ? '·' : ''} {product.brand.name}</span>
												{/if}
											{:else if lens}
												<span>{getLensTypeLabel(lens.type)}</span>
												<span>· {getLensSourceLabel(lens.source)}</span>
												{#if lens.material}
													<span>· {lens.material.name}</span>
												{/if}
											{/if}
										</div>
									</div>
								</div>
							</td>

							<td class="px-4 py-5 font-mono text-sm font-semibold text-brand-navy">
								{item.kind === 'product' ? item.quantity : 1}
							</td>

							<td class="px-4 py-5 font-mono text-sm text-on-surface-variant">
								{formatPrice(item.unitPrice)}
							</td>

							<td class="px-4 py-5">
								<span
									class="inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase {itemTaxMeta.className}"
								>
									{itemTaxMeta.label}
								</span>
							</td>

							<td class="px-4 py-5">
								<div class="flex items-center gap-2">
									<div class="inline-flex shrink-0 rounded-lg bg-surface-container-low p-1">
										<button
											type="button"
											onclick={() => {
												item.discountType = DiscountType.FIXED;
											}}
											class="flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold transition-colors {getDiscountToggleButtonClass(
												item.discountType === DiscountType.FIXED
											)}"
											aria-label="Descuento fijo"
										>
											$
										</button>
										<button
											type="button"
											onclick={() => {
												item.discountType = DiscountType.PERCENTAGE;
											}}
											class="flex h-8 w-8 items-center justify-center rounded-md text-sm font-semibold transition-colors {getDiscountToggleButtonClass(
												item.discountType === DiscountType.PERCENTAGE
											)}"
											aria-label="Descuento porcentual"
										>
											%
										</button>
									</div>
									<input
										type="number"
										bind:value={item.discount}
										step="0.01"
										min="0"
										max={getItemDiscountMax(item)}
										class="w-20 rounded-lg px-3 py-2 text-right font-mono text-sm focus:outline-none {isItemDiscountValid(
											item
										)
											? 'bg-surface-container-low text-brand-navy focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15'
											: 'border border-error bg-error-container/35 text-error focus:border-error focus:ring-2 focus:ring-error/15'}"
										aria-invalid={!isItemDiscountValid(item)}
									/>
								</div>
								{#if !isItemDiscountValid(item)}
									<p class="mt-2 text-[10px] font-semibold text-error">
										Max: {item.discountType === DiscountType.PERCENTAGE
											? '100%'
											: formatPrice(getItemDiscountBase(item))}
									</p>
								{/if}
							</td>

							<td
								class="px-6 py-5 text-right font-mono text-sm font-bold text-brand-navy sm:text-base"
							>
								{formatPrice(itemLineTotal(item))}
							</td>
						</tr>

						{#if item.kind === 'lens' && item.treatments.length > 0}
							{@const treatmentEyeCount = getEnabledEyeCount(item)}
							{#each item.treatments as treatment (treatment.supplierTreatmentId)}
								{@const treatmentTaxMeta = getTreatmentTaxMeta(treatment)}
								<tr class="bg-surface-container-low/20 text-on-surface-variant">
									<td class="px-6 py-4">
										<div class="flex items-start gap-3 pl-4 sm:pl-8">
											<span class="mt-2 h-1.5 w-1.5 rounded-full bg-brand-blue"></span>
											<div>
												<p
													class="text-[10px] font-semibold tracking-[0.16em] text-brand-blue uppercase"
												>
													Tratamiento
												</p>
												<div class="flex flex-wrap items-center gap-2">
													<p class="text-sm font-semibold text-brand-navy">{treatment.name}</p>
													<span
														class="rounded-full bg-brand-blue/10 px-2 py-0.5 text-[10px] font-semibold text-brand-blue uppercase"
													>
														{getTreatmentCategoryLabel(treatment.category)}
													</span>
												</div>
											</div>
										</div>
									</td>

									<td class="px-4 py-4 font-mono text-sm">{treatmentEyeCount}</td>

									<td class="px-4 py-4 font-mono text-sm text-on-surface-variant">
										{formatPrice(treatment.price)}
									</td>

									<td class="px-4 py-4">
										<span
											class="inline-flex rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase {treatmentTaxMeta.className}"
										>
											{treatmentTaxMeta.label}
										</span>
									</td>

									<td class="px-4 py-4">
										<div class="flex items-center gap-1 opacity-55 grayscale">
											<span
												class="rounded-md bg-surface-container-high px-2 py-1 text-[10px] font-semibold text-outline"
											>
												$
											</span>
											<span
												class="rounded-md bg-surface-container-high px-2.5 py-1 text-[10px] font-semibold text-outline"
											>
												0
											</span>
										</div>
									</td>

									<td class="px-6 py-4 text-right font-mono text-sm font-bold text-brand-navy">
										{formatPrice(treatment.price * treatmentEyeCount)}
									</td>
								</tr>
							{/each}
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-start">
		<div class="rounded-[1.5rem] bg-surface-container-lowest p-6 shadow-sm">
			<div class="mb-6 flex items-center gap-3">
				<div
					class="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue"
				>
					<ReceiptText class="h-5 w-5" />
				</div>
				<div>
					<p class="text-[11px] font-semibold tracking-[0.18em] text-brand-blue uppercase">
						{adjustmentsEyebrow}
					</p>
					<h3 class="font-heading text-xl font-bold tracking-[-0.02em] text-brand-navy">
						{adjustmentsTitle}
					</h3>
				</div>
			</div>

			<div class="space-y-4">
				<div class="rounded-2xl bg-surface-container-low px-4 py-4 sm:px-5">
					<div class="flex items-center justify-between gap-4">
						<span class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
							Subtotal bruto
						</span>
						<span class="font-mono text-2xl font-bold text-brand-navy">{formatPrice(subtotal)}</span
						>
					</div>
				</div>

				<div class="grid gap-4 sm:grid-cols-2">
					<div class="rounded-2xl bg-surface-container-low px-4 py-4">
						<p
							class="mb-3 text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
						>
							Tipo descuento
						</p>
						<div class="grid grid-cols-2 gap-2">
							<button
								type="button"
								onclick={() => {
									discountType = DiscountType.FIXED;
								}}
								class="rounded-xl px-3 py-2 text-sm font-semibold transition-colors {discountType ===
								DiscountType.FIXED
									? 'bg-brand-navy text-white'
									: 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'}"
							>
								Monto ($)
							</button>
							<button
								type="button"
								onclick={() => {
									discountType = DiscountType.PERCENTAGE;
								}}
								class="rounded-xl px-3 py-2 text-sm font-semibold transition-colors {discountType ===
								DiscountType.PERCENTAGE
									? 'bg-brand-navy text-white'
									: 'bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high'}"
							>
								Porc. (%)
							</button>
						</div>
					</div>

					<div class="rounded-2xl bg-surface-container-low px-4 py-4">
						<p
							class="mb-3 text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
						>
							Valor
						</p>
						<div class="relative">
							<input
								type="number"
								bind:value={discount}
								step="0.01"
								min="0"
								max={globalDiscountMax}
								class="w-full rounded-xl py-3 pr-10 pl-10 text-right font-mono text-lg font-semibold focus:outline-none {hasInvalidGlobalDiscount
									? 'border border-error bg-error-container/35 text-error focus:border-error focus:ring-2 focus:ring-error/15'
									: 'bg-surface-container-lowest text-brand-navy focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/15'}"
								aria-invalid={hasInvalidGlobalDiscount}
							/>
							<span
								class="absolute top-1/2 left-3 -translate-y-1/2 text-sm font-semibold text-outline"
							>
								{discountType === DiscountType.FIXED ? '$' : '%'}
							</span>
						</div>
						{#if hasInvalidGlobalDiscount}
							<p class="mt-2 text-[10px] font-semibold text-error">
								Max: {discountType === DiscountType.PERCENTAGE ? '100%' : formatPrice(subtotal)}
							</p>
						{/if}
					</div>
				</div>

				<div class="space-y-4">
					<div class="rounded-[1.5rem] bg-surface-container-low p-6 shadow-sm">
						<div class="space-y-4 text-sm sm:text-base">
							<div
								class="pb4 flex items-center justify-between gap-4 border-b border-outline-variant/50"
							>
								<span
									class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
								>
									Base imponible
								</span>
								<span class="font-mono font-semibold text-brand-navy">
									{formatPrice(adjustedTaxBreakdown.taxableBase)}
								</span>
							</div>

							<div
								class="pb4 flex items-center justify-between gap-4 border-b border-outline-variant/50"
							>
								<span
									class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
								>
									Total descuentos
								</span>
								<span class="font-mono font-semibold text-error">
									-{formatPrice(appliedGlobalDiscount)}
								</span>
							</div>

							<div class="flex items-center justify-between gap-4">
								<div class="flex items-center gap-2">
									<span
										class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
									>
										{taxSummaryLabel}
									</span>
									<span class="h-2 w-2 rounded-full bg-brand-blue"></span>
								</div>
								<span class="font-mono font-semibold text-brand-navy">
									{formatPrice(adjustedTaxBreakdown.taxAmount)}
								</span>
							</div>

							{#if adjustedTaxBreakdown.exemptTotal > 0}
								<div class="flex items-center justify-between gap-4">
									<span
										class="text-xs font-semibold tracking-[0.16em] text-on-surface-variant uppercase"
									>
										Exento
									</span>
									<span class="font-mono font-semibold text-brand-navy">
										{formatPrice(adjustedTaxBreakdown.exemptTotal)}
									</span>
								</div>
							{/if}
						</div>
					</div>

					<div
						class="relative overflow-hidden rounded-[1.5rem] bg-brand-navy px-6 py-7 text-white shadow-[0_24px_60px_rgba(21,35,70,0.22)] sm:px-8"
					>
						<div
							class="absolute top-0 right-0 h-40 w-40 rounded-full bg-brand-gold/10 blur-3xl"
						></div>
						<div class="relative z-10 flex items-end justify-between gap-6">
							<div>
								<p class="text-xs font-semibold tracking-[0.24em] text-brand-gold uppercase">
									{totalCardEyebrow}
								</p>
								<p
									class="mt-3 font-mono text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl"
								>
									{formatPrice(total)}
								</p>
								<p class="mt-3 text-sm text-white/65 sm:text-base">
									{items.length} articulo{items.length !== 1 ? 's' : ''} · {totalRenderedRows} fila{totalRenderedRows !==
									1
										? 's'
										: ''} revisadas
								</p>
							</div>

							<div
								class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-gold text-brand-navy shadow-lg shadow-black/15"
							>
								<ShoppingCart class="h-8 w-8" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<SaleWizardFloatingActions
		showBack={true}
		{onCancel}
		{cancelLabel}
		{primaryLabel}
		primaryDisabled={!canSubmitFinal}
		primaryLoading={submitting}
		primaryKind="confirm"
		summaryLabel="Total"
		summaryValue={formatPrice(total)}
		onBack={onprev}
		onPrimary={onsubmit}
	/>
</div>
