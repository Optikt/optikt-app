<script lang="ts">
	import { PurchaseSourceCurrency } from '$lib/shared/enums';
	import { formatPrice } from '$lib/utils';
	import { formatAltAmount } from '$lib/utils/purchaseOrderDetail';

	interface Props {
		amountAlt: number;
		amountUsd: number;
		sourceCurrency?: string;
		class?: string;
	}

	let {
		amountAlt,
		amountUsd,
		sourceCurrency = PurchaseSourceCurrency.USD,
		class: className = ''
	}: Props = $props();

	const isAlt = $derived(sourceCurrency !== PurchaseSourceCurrency.USD);
</script>

<span class="inline-flex flex-col items-end leading-tight {className}">
	{#if isAlt}
		<span class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
			{formatAltAmount(amountAlt, sourceCurrency)}
		</span>
		<span class="font-mono text-[10px] tracking-[0.12em] text-outline uppercase">
			{formatPrice(amountUsd)}
		</span>
	{:else}
		<span class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
			{formatPrice(amountUsd)}
		</span>
	{/if}
</span>
