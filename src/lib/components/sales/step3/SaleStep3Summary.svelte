<script lang="ts">
	import { formatPrice, getDiscountValueMax, isDiscountValueValid } from '$lib/utils';
	import { calculateAge } from '$lib/dates';
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
	import { Users } from '@lucide/svelte';
	import {
		clampAllocations,
		groupCode,
		groupDisplayLabel,
		normalizeGroupsForSubmit
	} from '$lib/shared/saleItemGroups';
	import PersonAvatar from '../groups/PersonAvatar.svelte';
	import { groupUnits, personColor, type UiGroup } from '../groups/groupsState';
	import { orderWizardRows, wizardGroupItems } from '../groups/wizardGroups';

	interface Props {
		items: SaleItemRow[];
		groups?: UiGroup[];
		primaryLensId?: string | null;
		docLabel?: string;
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
		groups = [],
		primaryLensId = null,
		docLabel,
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

	const groupViews = $derived(
		wizardGroupItems(items, catalog.getProducts(), catalog.getLensItems())
	);
	const activeGroups = $derived(normalizeGroupsForSubmit(clampAllocations(groups, groupViews)));
	const orderedItems = $derived(orderWizardRows(items, groupViews, activeGroups));

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

	const displayCustomerAge = $derived.by((): number | null => {
		if (newCustomer?.birthDate) return calculateAge(newCustomer.birthDate);
		if (selectedCustomer?.birthDate) return calculateAge(selectedCustomer.birthDate);
		return null;
	});
</script>

<div class="flex min-h-0 flex-1 flex-col gap-2">
	<SummaryHeader
		name={displayCustomerName}
		document={displayCustomerDocument}
		age={displayCustomerAge}
		statusLabel={statusMeta.label}
		bind:isCashea
		bind:notes
	/>

	<div class="flex min-h-0 flex-1 gap-3">
		<div class="flex min-w-0 flex-1 flex-col gap-2">
			{#if activeGroups.length > 0}
				<div
					class="flex flex-wrap items-center gap-2 rounded-lg border border-outline-variant/60 bg-white px-3 py-2"
				>
					<span
						class="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.08em] text-brand-navy uppercase"
					>
						<Users class="h-3.5 w-3.5" />
						Personas
					</span>
					{#each activeGroups as group, index (index)}
						{@const color = personColor(index)}
						{@const code = groupCode(docLabel, index)}
						{@const hasPrimary =
							primaryLensId !== null && group.members.some((m) => m.itemId === primaryLensId)}
						<span
							class="inline-flex items-center gap-1.5 rounded-full py-1 pr-3 pl-1.5 text-[13px] font-semibold"
							style:background-color={color.bg}
							style:color={color.fg}
						>
							<PersonAvatar label={group.label} {index} size="sm" />
							{#if code}
								<span
									class="rounded bg-white/85 px-1.5 py-0.5 font-mono text-xs font-bold tracking-tight"
									style:color={color.fg}
								>
									{code}
								</span>
							{/if}
							<span class="font-bold">{groupDisplayLabel(group.label, index)}</span>
							<span class="text-xs font-medium opacity-80">
								({groupUnits(group)})
							</span>
							{#if hasPrimary}
								<span class="text-[#947600]" aria-label="Fórmula del cliente">★</span>
							{/if}
						</span>
					{/each}
				</div>
			{/if}

			<SummaryItemList
				items={orderedItems}
				{defaultTaxRate}
				{groupViews}
				groups={activeGroups}
				{primaryLensId}
				{docLabel}
			/>
		</div>

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
