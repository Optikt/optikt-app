<script lang="ts">
	import { formatPrice } from '$lib/utils';
	import type { SaleWithRelations } from '$lib/server/db/queries/sales';

	interface Props {
		sale: SaleWithRelations;
		compact?: boolean;
	}

	let { sale, compact = false }: Props = $props();

	const pct = $derived(
		sale.total <= 0 ? 100 : Math.min(100, Math.round((sale.paidAmountBcvUsd / sale.total) * 100))
	);

	const label = $derived.by(() => {
		if (pct >= 100) return 'Pago completo';
		if (sale.paidAmountBcvUsd > 0) return `${formatPrice(sale.paidAmountBcvUsd)} abonado`;
		return 'Sin abono';
	});

	const barColor = $derived(
		pct >= 100 ? 'bg-success' : pct > 0 ? 'bg-warning' : 'bg-outline-variant'
	);

	const textColor = $derived(
		pct >= 100 ? 'text-success' : pct > 0 ? 'text-warning' : 'text-outline'
	);
</script>

<span>
	<div
		class="{compact
			? 'h-1'
			: 'h-1.5'} w-full overflow-hidden rounded-full bg-surface-container-highest"
	>
		<div class="h-full rounded-full transition-all {barColor}" style="width: {pct}%"></div>
	</div>
	{#if !compact}
		<p class="mt-1 font-mono text-[10px] font-bold tracking-wider uppercase {textColor}">
			{label}
		</p>
	{/if}
</span>
