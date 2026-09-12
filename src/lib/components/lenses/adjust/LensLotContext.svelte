<script lang="ts">
	import { AppBadge } from '$lib/components/ui';
	import type { InventoryLot } from '$lib/server/db/schema';
	import { formatPrice } from '$lib/utils';

	interface Props {
		activeLot: InventoryLot | null;
		realStock: number;
		supplierName: string | null | undefined;
	}

	let { activeLot, realStock, supplierName }: Props = $props();
</script>

<section class="glass-card bg-surface-container-lowest p-8">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h2 class="font-heading text-2xl font-bold tracking-[-0.02em] text-brand-navy">
				1. Contexto de Lote
			</h2>
			<p class="mt-1 max-w-2xl text-sm text-on-surface-variant">
				El ajuste se aplica sobre el lote activo del lente. Si no existe uno y registras una
				entrada, se creará un lote técnico nuevo con costo 0 para retomar la trazabilidad.
			</p>
		</div>

		<AppBadge variant={activeLot ? 'info' : 'warning'}>
			{activeLot ? 'Lote activo detectado' : 'Entrada crea lote nuevo'}
		</AppBadge>
	</div>

	<div class="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
		<div class="rounded-xl bg-surface-container-low px-4 py-4">
			<p class="text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase">Lote</p>
			<p class="mt-2 font-mono text-sm font-semibold text-brand-navy">
				{activeLot ? `LOT-${String(activeLot.lotNumber).padStart(4, '0')}` : 'Sin lote activo'}
			</p>
		</div>
		<div class="rounded-xl bg-surface-container-low px-4 py-4">
			<p class="text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase">
				Existencia lote
			</p>
			<p class="mt-2 font-mono text-sm font-semibold text-brand-navy">
				{activeLot?.quantityAvailable ?? 0}
			</p>
		</div>
		<div class="rounded-xl bg-surface-container-low px-4 py-4">
			<p class="text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase">Costo u.</p>
			<p class="mt-2 font-mono text-sm font-semibold text-brand-navy">
				{activeLot ? formatPrice(activeLot.unitPurchasePrice) : formatPrice(0)}
			</p>
		</div>
		<div class="rounded-xl bg-surface-container-low px-4 py-4">
			<p class="text-[0.68rem] font-bold tracking-[0.18em] text-outline uppercase">Proveedor</p>
			<p class="mt-2 text-sm font-semibold text-brand-navy">{supplierName ?? '—'}</p>
		</div>
	</div>

	{#if !activeLot}
		<div class="mt-5 rounded-xl bg-surface-container-low px-5 py-4 text-sm text-on-surface-variant">
			{#if realStock > 0}
				El lente tiene <span class="font-mono font-semibold text-brand-navy">{realStock}</span>
				uds en stock cacheado pero no existe un lote activo asociado. La próxima entrada manual creará
				un lote técnico con costo 0 para recuperar trazabilidad.
			{:else}
				No hay stock activo. Una entrada manual creará el primer lote técnico para este lente.
			{/if}
		</div>
	{/if}
</section>
