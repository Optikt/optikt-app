<script lang="ts">
	import { getSourceCurrencySymbol } from '$lib/shared/purchaseOrderCurrencies';
	import { formatPrice } from '$lib/utils';

	interface Props {
		supplierName: string;
		sourceCurrency: string;
		currencyLabel: string;
		bcvRate: number;
		sourceRateToVes?: number;
		lineCount?: number;
		totalItems?: number;
		totalCost?: number;
	}

	let {
		supplierName,
		sourceCurrency,
		currencyLabel,
		bcvRate,
		sourceRateToVes = 0,
		lineCount = 0,
		totalItems = 0,
		totalCost = 0
	}: Props = $props();

	const hasStats = $derived(lineCount > 0);
</script>

<aside
	class="sticky top-0 z-10 border-b border-outline-variant/30 bg-surface-container-low px-4 py-2"
	aria-label="Contexto de la orden"
>
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
		<span class="hidden text-on-surface-variant sm:inline">Proveedor:</span>
		<span class="font-semibold text-brand-navy">{supplierName}</span>

		<span class="text-outline" aria-hidden="true">·</span>

		<span class="hidden text-on-surface-variant sm:inline">Moneda:</span>
		<span class="font-semibold text-brand-navy">{currencyLabel}</span>

		<span class="text-outline" aria-hidden="true">·</span>

		<span class="hidden text-on-surface-variant sm:inline">Tasa BCV:</span>
		<span class="font-semibold text-brand-navy tabular-nums">{Number(bcvRate || 0).toFixed(2)}</span
		>

		{#if sourceRateToVes > 0}
			<span class="text-outline" aria-hidden="true">·</span>
			<span class="hidden text-on-surface-variant sm:inline"
				>{getSourceCurrencySymbol(sourceCurrency)}</span
			>
			<span class="font-semibold text-brand-navy tabular-nums">{sourceRateToVes}</span>
		{/if}

		{#if hasStats}
			<span class="text-outline" aria-hidden="true">·</span>
			<span class="text-on-surface-variant"
				>{lineCount} {lineCount === 1 ? 'línea' : 'líneas'} / {totalItems} unds</span
			>

			<span class="text-outline" aria-hidden="true">·</span>
			<span class="hidden text-on-surface-variant sm:inline">Total:</span>
			<span class="font-semibold text-brand-navy tabular-nums">{formatPrice(totalCost)}</span>
		{/if}
	</div>
</aside>
