<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatPrice, formatDate } from '$lib/utils';
	import { SaleStatusBadge } from '$lib/components/ui';
	import type { RecentSale } from '$lib/server/db/queries/dashboard';

	let { sales }: { sales: RecentSale[] } = $props();
</script>

{#if sales.length === 0}
	<p class="py-8 text-center text-sm text-slate-400">No hay ventas recientes</p>
{:else}
	<div class="divide-y divide-slate-100">
		{#each sales as sale (sale.id)}
			<a
				href={resolve(`/sales/${sale.id}`)}
				class="flex items-center justify-between gap-4 px-1 py-3 no-underline transition-colors hover:bg-slate-50"
			>
				<div class="min-w-0 flex-1">
					<div class="flex items-center gap-2">
						<span class="font-mono text-xs text-slate-400">#{sale.orderNumber}</span>
						<SaleStatusBadge status={sale.status} />
					</div>
					<p class="mt-0.5 truncate text-sm text-slate-700">
						{sale.customer ? `${sale.customer.firstName} ${sale.customer.lastName}` : 'Sin cliente'}
					</p>
				</div>
				<div class="text-right">
					<span class="font-mono text-sm font-semibold text-slate-800">
						{formatPrice(sale.total)}
					</span>
					<p class="mt-0.5 text-xs text-slate-400">
						{formatDate(sale.saleDate, { month: 'short' })}
					</p>
				</div>
			</a>
		{/each}
	</div>
{/if}
