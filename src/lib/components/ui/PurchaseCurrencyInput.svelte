<script lang="ts">
	import { Label, Select } from 'flowbite-svelte';
	import { ArrowRight, TrendingUp, TriangleAlert } from '@lucide/svelte';
	import {
		CurrencyCode,
		CURRENCY_LABELS,
		ALL_CURRENCY_CODES,
		isBaseCurrency
	} from '$lib/shared/enums';
	import { formatCurrency } from '$lib/utils';

	type PurchaseCurrencyInputProps = {
		/** Selected currency code */
		purchaseCurrency: CurrencyCode;
		/** Rate of purchase currency to VES */
		purchaseCurrencyRate: number;
		/** Rate of USD BCV to VES (always required) */
		purchaseUsdBcvRate: number;
		/** Date of the rates */
		purchaseDate: string;
		/** Purchase price (to show normalized cost) */
		purchasePrice: number;
		/** Sale price (to show real margin) */
		salePrice: number;
		/** Optional ID prefix for form elements */
		idPrefix?: string;
	};

	let {
		purchaseCurrency = $bindable(),
		purchaseCurrencyRate = $bindable(),
		purchaseUsdBcvRate = $bindable(),
		purchaseDate = $bindable(),
		purchasePrice,
		salePrice,
		idPrefix = ''
	}: PurchaseCurrencyInputProps = $props();

	const isBase = $derived(isBaseCurrency(purchaseCurrency));

	// When currency is USD_BCV, both rates are the same
	$effect(() => {
		if (isBaseCurrency(purchaseCurrency)) {
			purchaseCurrencyRate = purchaseUsdBcvRate;
		}
	});

	// Computed: normalized cost in USD BCV
	const normalizedCost = $derived.by(() => {
		if (!purchasePrice || !purchaseCurrencyRate || !purchaseUsdBcvRate) return 0;
		if (purchaseUsdBcvRate === 0) return 0;
		if (isBaseCurrency(purchaseCurrency)) return purchasePrice;
		return purchasePrice * (purchaseCurrencyRate / purchaseUsdBcvRate);
	});

	// Computed: differential percentage between currencies
	const differential = $derived.by(() => {
		if (!purchaseCurrencyRate || !purchaseUsdBcvRate || purchaseUsdBcvRate === 0) return 0;
		if (isBaseCurrency(purchaseCurrency)) return 0;
		return ((purchaseCurrencyRate - purchaseUsdBcvRate) / purchaseUsdBcvRate) * 100;
	});

	// Computed: real profit margin (based on normalized cost)
	const realMargin = $derived.by(() => {
		if (!normalizedCost || normalizedCost === 0) return 0;
		return ((salePrice - normalizedCost) / normalizedCost) * 100;
	});

	// Computed: apparent margin (without normalization)
	const apparentMargin = $derived.by(() => {
		if (!purchasePrice || purchasePrice === 0) return 0;
		return ((salePrice - purchasePrice) / purchasePrice) * 100;
	});
</script>

<!-- Hidden inputs to submit values with the form -->
<input type="hidden" name="purchaseCurrency" value={purchaseCurrency} />
<input type="hidden" name="purchaseCurrencyRate" value={purchaseCurrencyRate} />
<input type="hidden" name="purchaseUsdBcvRate" value={purchaseUsdBcvRate} />
<input type="hidden" name="purchaseDate" value={purchaseDate} />
<input type="hidden" name="normalizedCostUsd" value={normalizedCost} />

<!-- Currency Selection + Date -->
<div class="grid gap-4 md:grid-cols-2">
	<div>
		<Label for="{idPrefix}purchaseCurrency" class="mb-2">Moneda de compra *</Label>
		<Select id="{idPrefix}purchaseCurrency" bind:value={purchaseCurrency}>
			{#each ALL_CURRENCY_CODES as code (code)}
				<option value={code}>{CURRENCY_LABELS[code]}</option>
			{/each}
		</Select>
	</div>
	<div>
		<Label for="{idPrefix}purchaseDate" class="mb-2">Fecha de compra *</Label>
		<input
			type="date"
			id="{idPrefix}purchaseDate"
			bind:value={purchaseDate}
			required
			class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-sm"
		/>
	</div>
</div>

<!-- Exchange Rates -->
<div class="mt-4 grid gap-4" class:md:grid-cols-2={!isBase}>
	<!-- USD BCV Rate (always visible) -->
	<div>
		<Label for="{idPrefix}purchaseUsdBcvRate" class="mb-2">Tasa USD BCV (Bs/$) *</Label>
		<input
			type="number"
			id="{idPrefix}purchaseUsdBcvRate"
			bind:value={purchaseUsdBcvRate}
			step="0.01"
			min="0.01"
			required
			class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-sm"
			placeholder="Ej: 382.73"
		/>
	</div>

	<!-- Purchase currency rate (only if not USD_BCV) -->
	{#if !isBase}
		<div>
			<Label for="{idPrefix}purchaseCurrencyRate" class="mb-2">
				Tasa {CURRENCY_LABELS[purchaseCurrency]} (Bs) *
			</Label>
			<input
				type="number"
				id="{idPrefix}purchaseCurrencyRate"
				bind:value={purchaseCurrencyRate}
				step="0.01"
				min="0.01"
				required
				class="block w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 font-mono text-sm"
				placeholder="Ej: 545.00"
			/>
		</div>
	{/if}
</div>

<!-- Calculation Summary -->
{#if purchasePrice > 0 && purchaseUsdBcvRate > 0}
	<div class="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
		<div class="flex flex-wrap items-center gap-3">
			{#if !isBase && purchaseCurrencyRate > 0}
				<!-- Show differential -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-medium text-slate-500 uppercase">Diferencial</span>
					<span
						class="rounded-full px-2 py-0.5 font-mono text-xs font-bold"
						class:bg-amber-100={differential > 0}
						class:text-amber-700={differential > 0}
						class:bg-green-100={differential === 0}
						class:text-green-700={differential === 0}
					>
						{differential > 0 ? '+' : ''}{differential.toFixed(1)}%
					</span>
				</div>

				<ArrowRight class="h-4 w-4 text-slate-400" />

				<!-- Normalized cost -->
				<div class="flex items-center gap-2">
					<span class="text-xs font-medium text-slate-500 uppercase">Costo real</span>
					<span
						class="rounded-full bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-700"
					>
						${formatCurrency(normalizedCost)}
					</span>
				</div>
			{/if}

			{#if salePrice > 0}
				<ArrowRight class="h-4 w-4 text-slate-400" />

				<!-- Real margin -->
				<div class="flex items-center gap-2">
					<TrendingUp class="h-4 w-4 text-slate-400" />
					<span class="text-xs font-medium text-slate-500 uppercase">Margen real</span>
					<span
						class="rounded-full px-2 py-0.5 font-mono text-xs font-bold"
						class:bg-green-100={realMargin > 0}
						class:text-green-700={realMargin > 0}
						class:bg-red-100={realMargin <= 0}
						class:text-red-700={realMargin <= 0}
					>
						{realMargin.toFixed(1)}%
					</span>
				</div>

				{#if !isBase && apparentMargin !== realMargin}
					<span class="text-xs text-slate-400">(aparente: {apparentMargin.toFixed(1)}%)</span>
				{/if}
			{/if}
		</div>

		{#if realMargin < 0 && salePrice > 0}
			<div class="mt-2 flex items-center gap-1.5 text-xs text-red-600">
				<TriangleAlert class="h-3.5 w-3.5" />
				<span>El precio de venta no cubre el costo real de compra</span>
			</div>
		{/if}
	</div>
{/if}
