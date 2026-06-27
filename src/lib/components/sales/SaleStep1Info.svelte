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
		stepDescription?: string;
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
		stepDescription = 'Busca por documento para reutilizar un cliente existente o crea uno nuevo desde este mismo paso.',
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
	<!-- Creating customer: compact inline navy banner -->
	{#if creatingCustomer}
		<div class="rounded-lg bg-brand-navy px-4 py-2.5 text-white">
			<div class="flex items-center gap-2.5">
				<div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10">
					<UserPlus class="h-3.5 w-3.5 text-brand-gold" />
				</div>
				<p class="text-xs">
					<span class="font-semibold">Registro de nuevo cliente</span>
					<span class="text-white/60"> — Completa los datos para continuar</span>
				</p>
			</div>
		</div>
	{/if}

	<!-- Customer lookup: full width -->
	<div class="rounded-xl bg-surface-container-lowest px-4 py-4 shadow-sm">
		<p class="mb-2 text-[10px] font-semibold tracking-[0.14em] text-brand-blue uppercase">
			{stepLabel} - {stepTitle}
		</p>
		<p class="mb-3 text-xs leading-5 text-on-surface-variant">{stepDescription}</p>

		<div class="mt-3 rounded-xl bg-surface-container-low p-3">
			<CustomerLookupInput
				bind:customerId
				bind:newCustomer
				bind:selectedCustomer
				bind:creatingCustomer
			/>
		</div>
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
