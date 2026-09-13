<script lang="ts">
	import { Coins, History, ShieldCheck } from '@lucide/svelte';
	import { formatDate, formatPrice } from '$lib/utils';

	interface ManualAdjustment {
		createdAt: Date | string;
	}

	interface Props {
		lastManualAdjustment: ManualAdjustment | null;
		fifoCost: number | null;
	}

	let { lastManualAdjustment, fifoCost }: Props = $props();
</script>

<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
	<div class="rounded-xl bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
		<div class="flex items-center gap-3 text-brand-navy">
			<ShieldCheck class="h-4 w-4" />
			<p class="text-[0.68rem] font-bold tracking-[0.16em] uppercase">Audit log activo</p>
		</div>
		<p class="mt-2">
			Cada ajuste crea un movimiento inmutable sobre el lote activo o el lote técnico nuevo.
		</p>
	</div>

	<div class="rounded-xl bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
		<div class="flex items-center gap-3 text-brand-navy">
			<History class="h-4 w-4" />
			<p class="text-[0.68rem] font-bold tracking-[0.16em] uppercase">Ultimo ajuste manual</p>
		</div>
		<p class="mt-2">
			{lastManualAdjustment
				? formatDate(lastManualAdjustment.createdAt, {
						day: '2-digit',
						month: 'short',
						year: 'numeric'
					})
				: 'Sin ajustes manuales registrados'}
		</p>
	</div>

	<div class="rounded-xl bg-surface-container-low px-4 py-4 text-sm text-on-surface-variant">
		<div class="flex items-center gap-3 text-brand-navy">
			<Coins class="h-4 w-4" />
			<p class="text-[0.68rem] font-bold tracking-[0.16em] uppercase">Costo FIFO actual</p>
		</div>
		<p class="mt-2 font-mono text-brand-navy">
			{fifoCost != null ? formatPrice(fifoCost) : 'Sin lote activo'}
		</p>
	</div>
</div>
