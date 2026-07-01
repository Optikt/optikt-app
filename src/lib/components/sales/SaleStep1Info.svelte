<script lang="ts">
	import { UserPlus } from '@lucide/svelte';
	import CustomerLookupInput from './CustomerLookupInput.svelte';
	import SaleWizardFloatingActions from './SaleWizardFloatingActions.svelte';
	import type { Customer } from '$lib/server/db/schema';
	import type { NewCustomerData } from './newSaleTypes';

	interface Props {
		customerId: string;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		saleDate: Date;
		secondaryDate?: string;
		notes: string;
		nextOrderNumber?: number;
		entityNumberValue?: string;
		stepLabel?: string;
		stepTitle?: string;
		summaryLabel?: string;
		summaryValue?: string;
		primaryLabel?: string;
		valid: boolean;
		onnext: () => void;
	}

	let {
		customerId = $bindable(),
		selectedCustomer = $bindable(),
		newCustomer = $bindable(),
		saleDate = $bindable(),
		secondaryDate = $bindable(''),
		notes = $bindable(),
		nextOrderNumber,
		entityNumberValue,
		stepLabel = 'Paso 1: Información',
		stepTitle = 'Selecciona o registra al cliente',
		summaryLabel = 'Orden',
		summaryValue,
		primaryLabel = 'Continuar',
		valid,
		onnext
	}: Props = $props();

	let creatingCustomer = $state(newCustomer !== null);

	const resolvedEntityNumberValue = $derived(
		entityNumberValue ?? `#${String(nextOrderNumber ?? 0).padStart(4, '0')}`
	);

	const resolvedSummaryValue = $derived(summaryValue ?? resolvedEntityNumberValue);
</script>

<div class="space-y-4">
	<!-- Customer lookup: full width -->
	<div class="rounded-xl bg-surface-container-lowest px-4 py-4 shadow-sm">
		<p class="mb-1 text-[10px] font-semibold tracking-[0.14em] text-brand-blue uppercase">
			{stepLabel} - {stepTitle}
		</p>

		<CustomerLookupInput
			bind:customerId
			bind:newCustomer
			bind:selectedCustomer
			bind:creatingCustomer
		/>
	</div>

	<SaleWizardFloatingActions
		{primaryLabel}
		primaryDisabled={!valid}
		primaryKind="next"
		{summaryLabel}
		summaryValue={resolvedSummaryValue}
		onPrimary={onnext}
	/>
</div>
