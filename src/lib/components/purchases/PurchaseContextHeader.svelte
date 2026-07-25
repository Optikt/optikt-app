<script lang="ts">
	import { getCurrencyLabel } from '$lib/shared/enums';
	import { getSourceCurrencySymbol } from '$lib/shared/purchaseOrderCurrencies';

	interface Props {
		supplierName: string;
		sourceCurrency: string;
		currencyLabel: string;
		bcvRate: number;
		sourceRateToVes?: number;
	}

	let {
		supplierName,
		sourceCurrency,
		currencyLabel,
		bcvRate,
		sourceRateToVes = 0
	}: Props = $props();
</script>

<aside
	class="sticky top-0 z-10 border-b border-outline-variant/30 bg-surface-container-low px-4 py-2"
	aria-label="Contexto de la orden"
>
	<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
		<span class="text-on-surface-variant">Proveedor:</span>
		<span class="font-semibold text-brand-navy">{supplierName}</span>

		<span class="text-outline" aria-hidden="true">·</span>

		<span class="text-on-surface-variant">Moneda:</span>
		<span class="font-semibold text-brand-navy">{currencyLabel}</span>

		<span class="text-outline" aria-hidden="true">·</span>

		<span class="text-on-surface-variant">Tasa BCV:</span>
		<span class="font-semibold text-brand-navy tabular-nums">{Number(bcvRate || 0).toFixed(2)}</span
		>

		{#if sourceRateToVes > 0}
			<span class="text-outline" aria-hidden="true">·</span>
			<span class="text-on-surface-variant"
				>{getSourceCurrencySymbol(sourceCurrency)}
				{getCurrencyLabel(sourceCurrency)}:</span
			>
			<span class="font-semibold text-brand-navy tabular-nums">{sourceRateToVes}</span>
		{/if}
	</div>
</aside>
