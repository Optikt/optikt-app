<script lang="ts">
	import { ArrowLeft } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { getFullName } from '$lib/utils';
	import { getInitials } from './customerDetail';
	import type { Customer } from '$lib/server/db/schema';

	interface Props {
		customer: Customer;
		backHref: string;
	}

	let { customer, backHref }: Props = $props();
</script>

<a
	href={resolve(backHref as '/customers')}
	class="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-on-surface-variant transition-colors hover:text-brand-blue"
>
	<ArrowLeft class="h-4 w-4" />
	Volver a clientes
</a>

<div class="mb-6 flex items-center gap-4">
	<div class="flex items-center gap-4">
		<div
			class="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-blue/15 text-2xl font-bold text-brand-blue"
		>
			{getInitials(customer)}
		</div>
		<div>
			<h1 class="font-heading text-3xl font-bold text-brand-navy">
				{getFullName(customer)}
			</h1>
			{#if customer.idNumber}
				<span
					class="mt-1 inline-block rounded-md bg-surface-container-high px-2 py-0.5 font-mono text-sm text-on-surface-variant"
				>
					{customer.idNumber}
				</span>
			{/if}
		</div>
	</div>
</div>
