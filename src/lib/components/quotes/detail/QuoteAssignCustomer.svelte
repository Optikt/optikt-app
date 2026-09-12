<script lang="ts">
	import { Save, UserPlus } from '@lucide/svelte';
	import CustomerLookupInput from '$lib/components/sales/CustomerLookupInput.svelte';
	import type { Customer } from '$lib/server/db/schema';
	import type { NewCustomerData } from '$lib/components/sales/newSaleTypes';
	import { canSubmitAssignCustomer } from './quoteDetail';

	interface Props {
		assignCustomerId: string;
		assignSelectedCustomer: Customer | null;
		assignNewCustomer: NewCustomerData | null;
		assigningCustomer: boolean;
		onAssign: () => void;
	}

	let {
		assignCustomerId = $bindable(),
		assignSelectedCustomer = $bindable(),
		assignNewCustomer = $bindable(),
		assigningCustomer,
		onAssign
	}: Props = $props();
</script>

<div class="rounded-[1.5rem] border border-surface-container-high bg-surface-container-low p-5">
	<div class="mb-3 flex items-center gap-2">
		<UserPlus class="h-4 w-4 text-slate-500" />
		<p class="text-sm font-medium text-slate-700">Asignar cliente para poder convertir a venta</p>
	</div>
	<div class="flex items-end gap-3">
		<div class="flex-1">
			<CustomerLookupInput
				bind:customerId={assignCustomerId}
				bind:selectedCustomer={assignSelectedCustomer}
				bind:newCustomer={assignNewCustomer}
			/>
		</div>
		<button
			type="button"
			onclick={onAssign}
			disabled={assigningCustomer || !canSubmitAssignCustomer(assignCustomerId, assignNewCustomer)}
			class="inline-flex items-center gap-2 rounded-xl bg-brand-gold px-4 py-3 text-sm font-semibold text-brand-navy transition disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-outline"
		>
			<Save class="h-4 w-4" />
			Guardar
		</button>
	</div>
</div>
