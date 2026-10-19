<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { SaleStatusBadge } from '$lib/components/ui';
	import { getSaleStatusLabel } from '$lib/shared/enums';
	import { formatDateOnly } from '$lib/utils';
	import { calculateAge } from '$lib/dates';
	import { customerIdNumber, customerName, customerPhone } from './saleDetail';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales/types';

	interface Props {
		sale: SaleWithRelations;
		formattedOrderNumber: string;
	}

	let { sale, formattedOrderNumber }: Props = $props();

	const age = $derived(calculateAge(sale.customer?.birthDate));
</script>

<div class="rounded-xl border border-gray-100/50 bg-white p-6 shadow-sm">
	<div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
		<div>
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-sm font-medium text-gray-500">Cliente</p>
					<p class="mt-0.5 text-base font-semibold text-gray-900">{customerName(sale)}</p>
					<p class="text-xs text-gray-400">{customerIdNumber(sale)}</p>
					{#if sale.customer}
						<p class="text-xs text-gray-400">{customerPhone(sale)}</p>
					{/if}
					{#if age !== null}
						<p class="text-xs text-gray-400">{age} años</p>
					{/if}
				</div>
				{#if sale.customer}
					<a
						href={resolve(`/customers/${sale.customer.id}`)}
						class="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
					>
						<ExternalLink class="h-3.5 w-3.5" />
						Ver cliente
					</a>
				{/if}
			</div>
		</div>
		<div>
			<p class="text-sm font-medium text-gray-500">Vendedor</p>
			<p class="mt-0.5 text-base font-semibold text-gray-900">
				{sale.seller?.fullName ?? 'Sin asignar'}
			</p>
		</div>
		<div>
			<p class="text-sm font-medium text-gray-500">N° Orden</p>
			<p class="mt-0.5 text-base font-semibold text-gray-900">{formattedOrderNumber}</p>
		</div>
		<div>
			<p class="text-sm font-medium text-gray-500">Fecha</p>
			<p class="mt-0.5 text-base font-semibold text-gray-900">
				{formatDateOnly(sale.saleDate, { dateStyle: 'medium' })}
			</p>
		</div>
		<div>
			<p class="text-sm font-medium text-gray-500">Estado</p>
			<div class="mt-0.5">
				{#if sale.status === 'IN_PROGRESS'}
					<span
						class="inline-flex items-center rounded-md bg-blue-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-blue-700 uppercase"
					>
						{getSaleStatusLabel(sale.status)}
					</span>
				{:else}
					<SaleStatusBadge status={sale.status} />
				{/if}
			</div>
		</div>
	</div>
</div>
