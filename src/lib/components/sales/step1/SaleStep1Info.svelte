<script lang="ts">
	import { ArrowLeft, CalendarClock } from '@lucide/svelte';
	import CustomerLookupInput from '../CustomerLookupInput.svelte';
	import SaleWizardFloatingActions from '../SaleWizardFloatingActions.svelte';
	import CasheaCheckbox from '../CasheaCheckbox.svelte';
	import type { Customer } from '$lib/server/db/schema';
	import type { NewCustomerData } from '../newSaleTypes';

	interface Props {
		customerId: string;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		saleDate: Date;
		/** Presupuestos: "Válido hasta" (opcional; vacío = no vence). Enlazado ⇒ se muestra la card. */
		secondaryDate?: string;
		/** Muestra la card "Válido hasta" (presupuestos). */
		showSecondaryDate?: boolean;
		notes: string;
		isCashea?: boolean;
		nextOrderNumber?: number;
		entityNumberValue?: string;
		stepLabel?: string;
		stepTitle?: string;
		summaryLabel?: string;
		summaryValue?: string;
		primaryLabel?: string;
		casheaLabel?: string;
		casheaHint?: string;
		valid?: boolean;
		onnext: () => void;
	}

	let {
		customerId = $bindable(),
		selectedCustomer = $bindable(),
		newCustomer = $bindable(),
		saleDate = $bindable(),
		secondaryDate = $bindable(''),
		notes = $bindable(),
		isCashea = $bindable(false),
		nextOrderNumber,
		entityNumberValue,
		stepLabel = 'Paso 1: Información',
		stepTitle = 'Selecciona o registra al cliente',
		summaryLabel = 'Orden',
		summaryValue,
		primaryLabel = 'Continuar',
		casheaLabel,
		casheaHint,
		showSecondaryDate = false,
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

<div class="space-y-2">
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

		{#if showSecondaryDate}
			<!-- Presupuestos: Cashea + "Válido hasta" en dos columnas (mockup 5) -->
			<div class="mt-3 grid gap-3 md:grid-cols-[1fr_360px]">
				<CasheaCheckbox
					bind:isCashea
					size="lg"
					label={casheaLabel ?? 'Venta con Cashea'}
					hint={casheaHint ?? 'Financia el saldo a través de Cashea'}
				/>
				<label
					class="flex items-center gap-3 rounded-xl border border-outline-variant/60 px-3.5 py-2.5"
				>
					<CalendarClock class="h-5 w-5 shrink-0 text-on-surface-variant" />
					<span class="flex-1">
						<span class="block text-[13px] font-semibold">Válido hasta</span>
						<span class="block text-[12px] text-outline">Opcional · si queda vacío, no vence</span>
					</span>
					<input
						type="date"
						bind:value={secondaryDate}
						aria-label="Válido hasta"
						class="h-8 w-[130px] rounded-md border border-outline-variant/60 px-2 text-[13px]"
					/>
				</label>
			</div>
		{:else}
			<CasheaCheckbox bind:isCashea size="lg" class="mt-3" />
		{/if}
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
