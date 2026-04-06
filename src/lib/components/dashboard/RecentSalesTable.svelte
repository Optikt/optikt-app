<script lang="ts">
	import { resolve } from '$app/paths';
	import { formatPrice, formatDate } from '$lib/utils';
	import { SaleStatusBadge } from '$lib/components/ui';
	import type { RecentSale } from '$lib/server/db/queries/dashboard';

	let { sales }: { sales: RecentSale[] } = $props();

	function getInitials(sale: RecentSale): string {
		if (!sale.customer) return '??';
		const first = sale.customer.firstName?.charAt(0) ?? '';
		const last = sale.customer.lastName?.charAt(0) ?? '';
		return `${first}${last}`.toUpperCase();
	}

	function getCustomerName(sale: RecentSale): string {
		if (!sale.customer) return 'Sin cliente';
		return `${sale.customer.firstName} ${sale.customer.lastName}`;
	}
</script>

{#if sales.length === 0}
	<p class="py-8 text-center text-sm text-slate-400">No hay ventas recientes</p>
{:else}
	<div class="divide-y divide-slate-200">
		{#each sales as sale (sale.id)}
			<a
				href={resolve(`/sales/${sale.id}`)}
				class="flex items-center gap-3 rounded-lg px-3 py-4 no-underline transition-colors hover:bg-slate-50"
			>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-navy text-xs font-semibold text-white"
				>
					{getInitials(sale)}
				</div>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-slate-800">{getCustomerName(sale)}</p>
					<div class="mt-0.5 flex items-center gap-2">
						<span class="font-mono text-xs text-slate-400">Venta #{sale.orderNumber}</span>
						<span class="text-xs text-slate-300">•</span>
						<span class="text-xs text-slate-400"
							>{formatDate(sale.saleDate, { month: 'short' })}</span
						>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<span class="font-mono text-sm font-semibold text-slate-800">
						{formatPrice(sale.total)}
					</span>
					<SaleStatusBadge status={sale.status} />
				</div>
			</a>
		{/each}
	</div>
{/if}
