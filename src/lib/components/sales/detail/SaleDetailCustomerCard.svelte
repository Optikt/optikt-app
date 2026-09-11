<script lang="ts">
	import { SaleStatusBadge } from '$lib/components/ui';
	import { getSaleStatusLabel } from '$lib/shared/enums';
	import { formatDateOnly } from '$lib/utils';
	import { customerIdNumber, customerName } from './saleDetail';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales';

	interface Props {
		sale: SaleWithRelations;
		formattedOrderNumber: string;
	}

	let { sale, formattedOrderNumber }: Props = $props();
</script>

<div class="rounded-xl border border-gray-100/50 bg-white p-6 shadow-sm">
	<div class="grid gap-x-8 gap-y-4 sm:grid-cols-2">
		<div>
			<p class="text-sm font-medium text-gray-500">Cliente</p>
			<p class="mt-0.5 text-base font-semibold text-gray-900">{customerName(sale)}</p>
			<p class="text-xs text-gray-400">{customerIdNumber(sale)}</p>
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
