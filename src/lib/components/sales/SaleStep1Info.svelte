<script lang="ts">
	import { Button, Input, Label, Textarea } from 'flowbite-svelte';
	import { ChevronRight, Hash } from '@lucide/svelte';
	import { dateToISODateString } from '$lib/utils';
	import { fromISODate } from '$lib/dates';
	import CustomerLookupInput from './CustomerLookupInput.svelte';
	import type { Customer } from '$lib/server/db/schema';
	import type { NewCustomerData } from './newSaleTypes';

	interface Props {
		customerId: string;
		selectedCustomer: Customer | null;
		newCustomer: NewCustomerData | null;
		saleDate: Date;
		notes: string;
		nextOrderNumber?: number;
		valid: boolean;
		onnext: () => void;
	}

	let {
		customerId = $bindable(),
		selectedCustomer = $bindable(),
		newCustomer = $bindable(),
		saleDate = $bindable(),
		notes = $bindable(),
		nextOrderNumber,
		valid,
		onnext
	}: Props = $props();
</script>

<div class="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
	<div class="mb-6 flex items-center justify-between">
		<h3 class="text-xl font-semibold text-slate-800">Información de la Venta</h3>
		{#if nextOrderNumber}
			<div class="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2">
				<Hash class="h-5 w-5 text-blue-500" />
				<span class="font-mono text-lg font-bold text-blue-700">Orden {nextOrderNumber}</span>
			</div>
		{/if}
	</div>

	<div class="grid gap-5 sm:grid-cols-2">
		<!-- Customer Lookup -->
		<div class="sm:col-span-2">
			<CustomerLookupInput bind:customerId bind:newCustomer bind:selectedCustomer />
		</div>

		<!-- Date -->
		<div>
			<Label for="saleDate" class="mb-2 text-sm">Fecha de Venta *</Label>
			<Input
				id="saleDate"
				type="date"
				value={dateToISODateString(saleDate)}
				oninput={(e: Event) => {
					const target = e.target as HTMLInputElement;
					saleDate = fromISODate(target.value) ?? saleDate;
				}}
			/>
		</div>

		<!-- Notes -->
		<div>
			<Label for="notes" class="mb-2 text-sm">Notas</Label>
			<Textarea
				id="notes"
				bind:value={notes}
				placeholder="Observaciones adicionales..."
				rows={1}
				class="min-h-[42px] w-full"
			/>
		</div>
	</div>
</div>

<!-- Step 1 Navigation -->
<div class="mt-6 flex justify-end">
	<Button color="blue" size="lg" onclick={onnext} disabled={!valid}>
		Siguiente
		<ChevronRight class="ml-1 h-4 w-4" />
	</Button>
</div>
