<script lang="ts">
	import { ArrowLeft, UserPlus } from '@lucide/svelte';
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
	let resetCounter = $state(0);

	function triggerReset() {
		resetCounter += 1;
	}

	const resolvedEntityNumberValue = $derived(
		entityNumberValue ?? `#${String(nextOrderNumber ?? 0).padStart(4, '0')}`
	);

	const resolvedSummaryValue = $derived(summaryValue ?? resolvedEntityNumberValue);
</script>

<div class="space-y-3">
	<!-- Customer lookup: full width -->
	<div class="rounded-xl bg-surface-container-lowest px-4 py-3 shadow-sm">
		
		<div class="mb-1 flex items-center justify-between">
			<p class="text-[10px] font-semibold tracking-[0.14em] text-brand-blue uppercase">
				{stepLabel} - {stepTitle}
			</p>
			{#if creatingCustomer}
			<button
				type="button"
				onclick={triggerReset}
				class="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant/40 bg-surface-container px-2.5 py-1 text-xs font-medium text-on-surface-variant transition-colors hover:border-brand-navy hover:text-brand-navy"
			>
				<ArrowLeft class="h-3.5 w-3.5" />
				Volver a búsqueda
			</button>
		{/if}
		</div>

		<CustomerLookupInput
			bind:customerId
			bind:newCustomer
			bind:selectedCustomer
			bind:creatingCustomer
			resetKey={resetCounter}
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
