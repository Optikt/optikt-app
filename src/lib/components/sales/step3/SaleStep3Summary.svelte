<script lang="ts">
	import { formatPrice, getDiscountValueMax, isDiscountValueValid } from '$lib/utils';
	import { calculateSaleSummarySubtotal, buildTaxItemsFromWizard } from '../saleItemHelpers';
	import { computeAdjustedTaxBreakdown } from '../helpers/taxBreakdown';
	import { DiscountType, type DiscountType as DiscountTypeEnum } from '$lib/shared/enums';
	import type { Customer } from '$lib/server/db/schema';
	import type { SaleItemRow, NewCustomerData } from '../newSaleTypes';
	import SaleWizardFloatingActions from '../SaleWizardFloatingActions.svelte';
	import { getContext } from 'svelte';
	import { CATALOG_KEY, type CatalogData } from '../wizardContext';
	import { DEFAULT_TAX_RATE } from '$lib/shared/tax';
	import { formatTaxRate } from './summary/summaryViewModel';
	import SummaryHeader from './summary/SummaryHeader.svelte';
	import SummaryItemList from './summary/SummaryItemList.svelte';
	import SummaryTotals from './summary/SummaryTotals.svelte';
	import SummaryGlobalDiscount from './summary/SummaryGlobalDiscount.svelte';

	interface Props {
		items: SaleItemRow[];
		customerId?: string;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		discount: number;
		discountType: DiscountTypeEnum;
		notes: string;
		isCashea?: boolean;
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

	let {
		items,
		customerId = '',
		selectedCustomer,
		newCustomer,
		discount = $bindable(),
		discountType = $bindable(),
		notes = $bindable(),
		isCashea = $bindable(false),
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

	const catalog = getContext<CatalogData>(CATALOG_KEY);

	const grossSubtotal = $derived(calculateSaleSummarySubtotal(items));

	const rawGlobalDiscountAmount = $derived(
		discountType === DiscountType.PERCENTAGE ? (discount / 100) * grossSubtotal : discount
	);

	const appliedGlobalDiscount = $derived(
		Math.min(Math.max(rawGlobalDiscountAmount, 0), grossSubtotal)
	);

	const globalDiscountMax = $derived(getDiscountValueMax(discountType, grossSubtotal));

	const hasInvalidGlobalDiscount = $derived(
		!isDiscountValueValid(discount, discountType, grossSubtotal)
	);

	const canSubmitFinal = $derived(canSubmit && !hasInvalidGlobalDiscount);

	const taxItems = $derived(
		buildTaxItemsFromWizard(items, catalog.getProducts(), catalog.getLensItems(), defaultTaxRate)
	);

	const adjustedTaxBreakdown = $derived.by(() =>
		computeAdjustedTaxBreakdown(taxItems, appliedGlobalDiscount)
	);

	const total = $derived(adjustedTaxBreakdown.total);

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
</script>

<div class="flex min-h-0 flex-1 flex-col gap-2">
	<SummaryHeader
		name={displayCustomerName}
		document={displayCustomerDocument}
		statusLabel={statusMeta.label}
		bind:isCashea
		bind:notes
	/>

	<div class="flex min-h-0 flex-1 gap-3">
		<SummaryItemList {items} {defaultTaxRate} />

		<div class="w-64 shrink-0 space-y-2">
			<SummaryTotals
				adjusted={adjustedTaxBreakdown}
				{appliedGlobalDiscount}
				{taxSummaryLabel}
				{total}
			/>

			<SummaryGlobalDiscount
				bind:discount
				bind:discountType
				{globalDiscountMax}
				{hasInvalidGlobalDiscount}
				{grossSubtotal}
			/>
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
