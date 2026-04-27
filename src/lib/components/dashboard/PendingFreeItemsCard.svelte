<script lang="ts">
	import { Sparkles, ArrowRight } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import type { PendingFreeItemSale } from '$lib/server/db/queries/dashboard';

	let { sales }: { sales: PendingFreeItemSale[] } = $props();

	const totalPending = $derived(sales.reduce((acc, s) => acc + s.pendingCount, 0));
</script>

<div class="glass-card p-6">
	<div class="mb-4 flex items-center gap-3">
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-600"
		>
			<Sparkles size={20} />
		</div>
		<div>
			<p class="text-xs font-semibold tracking-wider text-slate-400 uppercase">
				Ítems Libres Pendientes
			</p>
			<p class="font-heading text-xl font-bold text-brand-navy">
				{totalPending}
				{totalPending === 1 ? 'ítem' : 'ítems'} por completar
			</p>
		</div>
	</div>

	<p class="mb-4 text-sm leading-6 text-on-surface-variant">
		Las siguientes ventas tienen ítems libres sin costo ni proveedor asignado. Complétalos cuando
		llegue el pedido.
	</p>

	<ul class="space-y-2">
		{#each sales as sale (sale.id)}
			<li>
				<a
					href={resolve(`/sales/${sale.id}`)}
					class="flex items-center justify-between rounded-xl border border-violet-100 bg-violet-50/60 px-4 py-3 no-underline transition-colors hover:bg-violet-100/70"
				>
					<div>
						<span class="text-sm font-semibold text-brand-navy">
							Venta #{sale.orderNumber}
						</span>
						{#if sale.customer}
							<span class="ml-2 text-sm text-on-surface-variant">
								— {sale.customer.firstName}
								{sale.customer.lastName}
							</span>
						{/if}
					</div>
					<div class="flex items-center gap-2">
						<span
							class="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800"
						>
							{sale.pendingCount}
							{sale.pendingCount === 1 ? 'pendiente' : 'pendientes'}
						</span>
						<ArrowRight class="h-4 w-4 text-violet-500" />
					</div>
				</a>
			</li>
		{/each}
	</ul>
</div>
