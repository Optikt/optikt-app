<script lang="ts">
	interface Props {
		pairPurchasePrice: number;
		operationalCost: number;
		grossProfit: number | null;
		marginPercent: number | null;
		totalWithTax: number;
	}

	let { pairPurchasePrice, operationalCost, grossProfit, marginPercent, totalWithTax }: Props = $props();

	function formatPrice(value: number | null): string {
		if (value == null) return '—';
		return new Intl.NumberFormat('es-VE', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2
		}).format(value);
	}
</script>

<div class="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
	<h4 class="mb-3 text-sm font-bold text-brand-navy dark:text-white">Resumen de Precios</h4>
	<div class="space-y-2 text-sm">
		<div class="flex justify-between">
			<span class="text-slate-600 dark:text-slate-400">Costo par</span>
			<span class="font-mono font-semibold">{formatPrice(pairPurchasePrice)}</span>
		</div>
		<div class="flex justify-between">
			<span class="text-slate-600 dark:text-slate-400">Costo operativo</span>
			<span class="font-mono font-semibold">{formatPrice(operationalCost)}</span>
		</div>
		{#if grossProfit != null}
			<div class="flex justify-between">
				<span class="text-slate-600 dark:text-slate-400">Ganancia bruta</span>
				<span class="font-mono font-semibold text-green-600">{formatPrice(grossProfit)}</span>
			</div>
		{/if}
		{#if marginPercent != null}
			<div class="flex justify-between">
				<span class="text-slate-600 dark:text-slate-400">Margen</span>
				<span class="font-mono font-semibold">{marginPercent.toFixed(1)}%</span>
			</div>
		{/if}
		<div class="flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-slate-600">
			<span>Total con impuesto</span>
			<span class="font-mono">{formatPrice(totalWithTax)}</span>
		</div>
	</div>
</div>
