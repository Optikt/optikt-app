<script lang="ts">
	import { Button, Input, Label, Textarea } from 'flowbite-svelte';
	import { ChevronRight, Hash } from '@lucide/svelte';
	import { dateToISODateString } from '$lib/utils';
	import { fromISODate } from '$lib/dates';
	import CustomerLookupInput from '$lib/components/sales/CustomerLookupInput.svelte';
	import type { Customer } from '$lib/server/db/schema';
	import type { NewCustomerData } from '$lib/components/sales/newSaleTypes';

	interface Props {
		customerId: string;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		quoteDate: Date;
		notes: string;
		validUntil: string;
		nextQuoteNumber?: number;
		onnext: () => void;
	}

	let {
		customerId = $bindable(),
		selectedCustomer = $bindable(),
		newCustomer = $bindable(),
		quoteDate = $bindable(),
		notes = $bindable(),
		validUntil = $bindable(),
		nextQuoteNumber,
		onnext
	}: Props = $props();
</script>

<div class="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
	<div class="mb-6 flex items-center justify-between">
		<h3 class="text-xl font-semibold text-slate-800">Información del Presupuesto</h3>
		{#if nextQuoteNumber}
			<div class="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2">
				<Hash class="h-5 w-5 text-blue-500" />
				<span class="font-mono text-lg font-bold text-blue-700">P-{nextQuoteNumber}</span>
			</div>
		{/if}
	</div>

	<div class="grid gap-5 sm:grid-cols-2">
		<!-- Customer Lookup (optional) -->
		<div class="sm:col-span-2">
			<div class="mb-1 flex items-center gap-2">
				<Label class="text-sm">Cliente</Label>
				<span class="text-xs text-slate-400">(opcional — se puede asignar luego)</span>
			</div>
			<CustomerLookupInput bind:customerId bind:newCustomer bind:selectedCustomer />
		</div>

		<!-- Date -->
		<div>
			<Label for="quoteDate" class="mb-2 text-sm">Fecha del Presupuesto *</Label>
			<Input
				id="quoteDate"
				type="date"
				value={dateToISODateString(quoteDate)}
				oninput={(e: Event) => {
					const target = e.target as HTMLInputElement;
					quoteDate = fromISODate(target.value) ?? quoteDate;
				}}
			/>
		</div>

		<!-- Valid Until -->
		<div>
			<Label for="validUntil" class="mb-2 text-sm">Válido hasta</Label>
			<Input id="validUntil" type="date" bind:value={validUntil} />
		</div>

		<!-- Notes -->
		<div class="sm:col-span-2">
			<Label for="notes" class="mb-2 text-sm">Notas</Label>
			<Textarea
				id="notes"
				bind:value={notes}
				placeholder="Observaciones adicionales..."
				rows={2}
				class="min-h-[42px] w-full"
			/>
		</div>
	</div>
</div>

<!-- Step 1 Navigation (always valid for quotes) -->
<div class="mt-6 flex justify-end">
	<Button color="blue" size="lg" onclick={onnext}>
		Siguiente
		<ChevronRight class="ml-1 h-4 w-4" />
	</Button>
</div>
