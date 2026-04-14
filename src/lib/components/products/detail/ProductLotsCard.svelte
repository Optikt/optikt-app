<script lang="ts">
	import { ArrowRightLeft, Layers3 } from '@lucide/svelte';
	import { resolve } from '$app/paths';
	import { AppBadge } from '$lib/components/ui';
	import { formatDate, formatPrice } from '$lib/utils';

	interface ActiveLot {
		id: string;
		lotNumber: number;
		quantityAvailable: number;
		unitPurchasePrice: number;
		createdAt: Date | string;
	}

	interface Props {
		activeLots: ActiveLot[];
		productId: string;
		realStock: number;
	}

	let { activeLots, productId, realStock }: Props = $props();
</script>

<section class="glass-card bg-surface-container-lowest p-8">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h2 class="font-heading text-2xl font-bold tracking-[-0.02em] text-brand-navy">
				Lotes Activos (FIFO)
			</h2>
			<p class="mt-1 text-[0.7rem] font-bold tracking-[0.18em] text-outline uppercase">
				Gestion de stock por entrada
			</p>
		</div>

		<div class="flex items-center gap-4">
			<p class="text-sm text-on-surface-variant">
				Stock real: <span class="font-mono font-semibold text-brand-navy">{realStock}</span>
			</p>
			<a
				href={resolve(`/products/${productId}/adjustments`)}
				class="inline-flex items-center gap-2 rounded-lg bg-surface-container-low px-4 py-2.5 text-sm font-semibold text-brand-blue transition-colors hover:bg-surface-container"
			>
				<ArrowRightLeft class="h-4 w-4" />
				Ajustar stock
			</a>
		</div>
	</div>

	{#if activeLots.length > 0}
		<div class="mt-6 overflow-x-auto">
			<table class="min-w-full border-separate [border-spacing:0_0.6rem] text-left">
				<thead>
					<tr>
						<th class="px-2 pb-2 text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Lote</th>
						<th class="px-2 pb-2 text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Stock</th>
						<th class="px-2 pb-2 text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Costo u.</th>
						<th class="px-2 pb-2 text-[0.65rem] font-bold tracking-[0.18em] text-outline uppercase">Ingreso</th>
					</tr>
				</thead>
				<tbody>
					{#each activeLots as lot, index (lot.id)}
						<tr class="bg-surface-container-low transition-colors hover:bg-surface-container">
							<td class="rounded-l-lg px-4 py-4">
								<div class="flex items-center gap-2">
									<p class="font-mono text-xs font-semibold tracking-[0.12em] text-brand-navy">
										#LOT-{String(lot.lotNumber).padStart(4, '0')}
									</p>
									{#if index === 0}
										<AppBadge variant="info">FIFO</AppBadge>
									{/if}
								</div>
							</td>
							<td class="px-4 py-4 font-mono text-sm font-semibold text-brand-navy">
								{lot.quantityAvailable}
							</td>
							<td class="px-4 py-4 font-mono text-sm text-on-surface-variant">
								{formatPrice(lot.unitPurchasePrice)}
							</td>
							<td class="rounded-r-lg px-4 py-4 text-sm text-on-surface-variant">
								{formatDate(lot.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="mt-6 rounded-xl bg-surface-container-low px-6 py-10 text-center">
			<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-container text-outline">
				<Layers3 class="h-5 w-5" />
			</div>
			<p class="mt-4 font-semibold text-brand-navy">No hay lotes activos para este producto</p>
			<p class="mt-1 text-sm text-on-surface-variant">
				Usa un ajuste o una orden de compra para ingresar stock.
			</p>
		</div>
	{/if}
</section>