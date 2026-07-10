<script lang="ts">
	import { FileText } from '@lucide/svelte';
	import { formatPrice, getDiscountValueMax, isDiscountValueValid } from '$lib/utils';
	import {
		calculateSaleSummarySubtotal,
		buildTaxItemsFromWizard,
		findLensItem,
		findProduct,
		getEnabledEyeCount,
		getItemDiscountBase,
		getItemDiscountMax,
		isItemDiscountValid,
		itemLineTotal
	} from '../saleItemHelpers';
	import {
		DiscountType,
		getTreatmentCategoryLabel,
		type DiscountType as DiscountTypeEnum
	} from '$lib/shared/enums';

	import type { ProductWithRelations } from '$lib/server/db/queries/products';
	import type { LensCatalogItemWithRelations } from '$lib/server/db/queries/lenses';
	import type { Customer } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from '../newSaleTypes';
	import SaleCustomerBanner from '../SaleCustomerBanner.svelte';
	import SaleItemInfo from '../SaleItemInfo.svelte';
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
		discount: number;
		discountType: DiscountTypeEnum;
		notes: string;
		defaultTaxRate?: number;
		customerFallbackName?: string;
		customerFallbackDocument?: string;
		submittingStatusLabel?: string;
		readyStatusLabel?: string;
		pendingStatusLabel?: string;
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
		discount = $bindable(),
		discountType = $bindable(),
		notes = $bindable(),
		defaultTaxRate = DEFAULT_TAX_RATE,
		customerFallbackName = 'Venta sin cliente',
		customerFallbackDocument = 'Sin documento',
		submittingStatusLabel = 'Registrando venta',
		readyStatusLabel = 'Revision final',
		pendingStatusLabel = 'Ajustes pendientes',
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



	function getProduct(item: SaleItemRow): ProductWithRelations | undefined {
		return findProduct(item, products);
	}

	function getLens(item: SaleItemRow): LensCatalogItemWithRelations | undefined {
		return findLensItem(item, lensItems);
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

<div class="flex min-h-0 flex-1 flex-col gap-2">
	<SaleCustomerBanner
		name={displayCustomerName}
		document={displayCustomerDocument}
		statusLabel={statusMeta.label}
	/>

	<!-- Nota inline -->
	<div class="flex shrink-0 items-center gap-1.5">
		<FileText class="h-3 w-3 shrink-0 text-slate-400" />
		<input
			type="text"
			bind:value={notes}
			placeholder="Nota de la venta..."
			class="w-full border-0 bg-transparent px-0 py-0 text-xs text-slate-600 placeholder-slate-400 focus:ring-0 focus:outline-none"
		/>
	</div>

	<!-- 2-columnas: items + resumen -->
	<div class="flex min-h-0 flex-1 gap-3">
		<!-- Items -->
		<div class="min-w-0 flex-1 space-y-1 overflow-y-auto">
			{#each items as item (item.id)}
				{@const itemTaxMeta = getItemTaxMeta(item)}
				<div class="rounded-lg border border-slate-300 bg-white p-1">
					<div class="space-y-1">
						<div class="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
							<SaleItemInfo {item} />

							<!-- Step 3 controls: qty · price · tax · discount · total -->
							<div class="flex w-1/3 shrink-0 flex-col items-end gap-1">
								<div class="flex items-center gap-1 text-[10px] text-slate-500">
									<span>CANT {item.kind === 'product' ? item.quantity : 1}</span>
									<span class="text-slate-300">·</span>
									<span>{formatPrice(item.unitPrice)}</span>
									<span class="text-slate-300">·</span>
									<span
										class="rounded-full px-1.5 py-0.5 text-[9px] font-semibold {itemTaxMeta.className}"
									>
										{itemTaxMeta.label}
									</span>
								</div>
								<div class="flex items-center gap-1">
									<div class="inline-flex rounded-md bg-slate-100 p-0.5">
										<button
											type="button"
											onclick={() => {
												item.discountType = DiscountType.FIXED;
											}}
											class="flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold transition-colors {getDiscountToggleButtonClass(
												item.discountType === DiscountType.FIXED
											)}"
										>
											$
										</button>
										<button
											type="button"
											onclick={() => {
												item.discountType = DiscountType.PERCENTAGE;
											}}
											class="flex h-5 w-5 items-center justify-center rounded text-[10px] font-semibold transition-colors {getDiscountToggleButtonClass(
												item.discountType === DiscountType.PERCENTAGE
											)}"
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
										class="w-14 rounded border px-1 py-0.5 text-right font-mono text-[10px] focus:outline-none {isItemDiscountValid(
											item
										)
											? 'border-slate-200 bg-white text-slate-700'
											: 'border-red-300 bg-red-50 text-red-600'}"
									/>
									<div class="rounded-lg bg-surface-container-low px-2 py-1">
										<span class="font-mono text-xs font-semibold text-brand-navy">
											{formatPrice(itemLineTotal(item))}
										</span>
									</div>
								</div>
								{#if !isItemDiscountValid(item)}
									<p class="text-[9px] font-semibold text-error">
										Max: {item.discountType === DiscountType.PERCENTAGE
											? '100%'
											: formatPrice(getItemDiscountBase(item))}
									</p>
								{/if}
							</div>
						</div>
					</div>

					<!-- Treatments -->
					{#if item.kind === 'lens' && item.treatments.length > 0}
						{@const treatmentEyeCount = getEnabledEyeCount(item)}
						<div class="space-y-0.5">
							{#each item.treatments as treatment (treatment.supplierTreatmentId)}
								<div
									class="ml-5 flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-1.5"
								>
									<div class="flex items-center gap-1.5">
										<span class="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-blue"></span>
										<span class="text-[11px] text-slate-600">{treatment.name}</span>
										<span
											class="rounded-full bg-brand-blue/10 px-1.5 py-0.5 text-[9px] font-semibold text-brand-blue"
										>
											{getTreatmentCategoryLabel(treatment.category)}
										</span>
									</div>
									<span class="font-mono text-[11px] text-slate-700"
										>{formatPrice(treatment.price * treatmentEyeCount)}</span
									>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Summary -->
		<div class="w-64 shrink-0 space-y-2">
			<div class="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
				<div class="space-y-1">
					<div class="flex items-center justify-between text-xs">
						<span class="text-slate-500">Subtotal</span>
						<span class="font-semibold text-brand-navy">{formatPrice(subtotal)}</span>
					</div>
					<div class="flex items-center justify-between text-xs">
						<span class="text-slate-500">Descuento global</span>
						<span class="font-semibold text-red-500">-{formatPrice(appliedGlobalDiscount)}</span>
					</div>
					<div class="flex items-center justify-between text-xs">
						<span class="text-slate-500">{taxSummaryLabel}</span>
						<span class="font-semibold text-brand-navy"
							>{formatPrice(adjustedTaxBreakdown.taxAmount)}</span
						>
					</div>
					{#if adjustedTaxBreakdown.exemptTotal > 0}
						<div class="flex items-center justify-between text-xs">
							<span class="text-slate-500">Exento</span>
							<span class="font-semibold text-brand-navy"
								>{formatPrice(adjustedTaxBreakdown.exemptTotal)}</span
							>
						</div>
					{/if}
				</div>
				<div
					class="mt-2 flex items-center justify-between border-t border-slate-200 pt-2 text-sm font-bold text-brand-navy"
				>
					<span>Total</span>
					<span>{formatPrice(total)}</span>
				</div>
			</div>

			<div class="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
				<p class="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
					Descuento global
				</p>
				<div class="mt-1.5 grid grid-cols-2 gap-1">
					<button
						type="button"
						onclick={() => {
							discountType = DiscountType.FIXED;
						}}
						class="rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors {discountType ===
						DiscountType.FIXED
							? 'bg-brand-navy text-white'
							: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
					>
						Monto ($)
					</button>
					<button
						type="button"
						onclick={() => {
							discountType = DiscountType.PERCENTAGE;
						}}
						class="rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors {discountType ===
						DiscountType.PERCENTAGE
							? 'bg-brand-navy text-white'
							: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
					>
						Porc. (%)
					</button>
				</div>
				<div class="relative mt-1.5">
					<input
						type="number"
						bind:value={discount}
						step="0.01"
						min="0"
						max={globalDiscountMax}
						class="w-full rounded-lg py-1 pr-2 pl-6 text-right font-mono text-xs font-semibold focus:outline-none {hasInvalidGlobalDiscount
							? 'border border-red-300 bg-red-50 text-red-600'
							: 'border border-slate-200 bg-white text-brand-navy'}"
						aria-invalid={hasInvalidGlobalDiscount}
					/>
					<span class="absolute top-1/2 left-2 -translate-y-1/2 text-[10px] text-slate-400">
						{discountType === DiscountType.FIXED ? '$' : '%'}
					</span>
				</div>
				{#if hasInvalidGlobalDiscount}
					<p class="mt-1 text-[9px] font-semibold text-error">
						Max: {discountType === DiscountType.PERCENTAGE ? '100%' : formatPrice(subtotal)}
					</p>
				{/if}
			</div>
		</div>
	</div>

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
