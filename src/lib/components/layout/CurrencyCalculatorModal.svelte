<script lang="ts">
	import { DollarSign, Euro, RefreshCw, X } from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { fromISO, toRelative, toRelativeShort } from '$lib/dates';
	import type { ExchangeRateEntry, ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';

	interface Props {
		open: boolean;
		snapshot: ExchangeRatesSnapshot | null;
		refreshing?: boolean;
		onClose: () => void;
		onRefresh: (event: MouseEvent) => void;
	}

	let { open = $bindable(), snapshot, refreshing = false, onClose, onRefresh }: Props = $props();

	const rates = $derived(snapshot?.rates ?? []);

	// Base currency: 'bs' or a sourceKey (e.g. 'usd_bcv')
	let baseCurrency = $state('bs');
	let rawInput = $state('');

	const amount = $derived(parseFloat(rawInput) || 0);

	// Short currency code from sourceKey (esd_bcv → USD, usdt_binance → USDT)
	function currencyCode(sourceKey: string): string {
		return sourceKey.split('_')[0].toUpperCase();
	}

	type ConversionResult = {
		rate: ExchangeRateEntry;
		label: string;
		code: string;
		value: number;
	};

	// All conversion results given current amount and base
	const conversions = $derived.by((): ConversionResult[] => {
		if (rates.length === 0) return [];

		if (baseCurrency === 'bs') {
			return rates.map((rate) => ({
				rate,
				label: rate.label,
				code: currencyCode(rate.sourceKey),
				value: amount > 0 ? amount / rate.value : 0
			}));
		}

		const selectedRate = rates.find((r) => r.sourceKey === baseCurrency);
		if (!selectedRate) return [];

		const bsAmount = amount * selectedRate.value;

		return rates
			.filter((r) => r.sourceKey !== baseCurrency)
			.map((rate) => ({
				rate,
				label: rate.label,
				code: currencyCode(rate.sourceKey),
				value: amount > 0 ? bsAmount / rate.value : 0
			}))
			.concat([
				{
					rate: selectedRate,
					label: 'Bolívares',
					code: 'Bs',
					value: amount > 0 ? bsAmount : 0
				} as ConversionResult
			])
			.sort((a, b) => (a.code === 'Bs' ? 1 : b.code === 'Bs' ? -1 : 0));
	});

	type RateStyle = { bg: string; iconClass: string; icon?: Component; svgSrc?: string };

	function getRateStyle(sourceKey: string): RateStyle {
		if (sourceKey.startsWith('eur'))
			return { bg: 'bg-indigo-100', iconClass: 'text-indigo-500', icon: Euro };
		if (sourceKey.includes('usdt') || sourceKey.includes('binance'))
			return { bg: 'bg-[#53ae94]/15', iconClass: 'text-[#53ae94]', svgSrc: '/tether.svg' };
		return { bg: 'bg-brand-blue/15', iconClass: 'text-brand-blue', icon: DollarSign };
	}

	function getBsCurrencyLabel(): string {
		if (baseCurrency === 'bs') return 'Bs';
		const rate = rates.find((r) => r.sourceKey === baseCurrency);
		if (!rate) return '';
		return currencyCode(rate.sourceKey);
	}

	function formatValue(value: number): string {
		if (value === 0) return '—';
		if (value >= 1000)
			return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
		return value.toFixed(4).replace(/\.?0+$/, '') || '0';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onClose();
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
		onkeydown={handleKeydown}
		onclick={handleBackdropClick}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="calc-modal-title"
			class="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
				<div>
					<h2 id="calc-modal-title" class="text-sm font-semibold text-brand-navy">
						Calculadora de monedas
					</h2>
					<p class="mt-0.5 text-[11px] text-slate-400">Tasas sincronizadas en segundo plano</p>
				</div>
				<div class="flex items-center gap-1.5">
					<button
						type="button"
						class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue transition-colors hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={onRefresh}
						disabled={refreshing}
						title="Refrescar tasas"
					>
						<RefreshCw class={refreshing ? 'animate-spin' : ''} size={14} />
					</button>
					<button
						type="button"
						class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
						onclick={onClose}
						aria-label="Cerrar calculadora"
					>
						<X size={16} />
					</button>
				</div>
			</div>

			<!-- Input section -->
			<div class="px-5 pt-4 pb-3">
				<!-- Base currency selector -->
				<div class="mb-3 flex gap-1.5">
					<button
						type="button"
						class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {baseCurrency ===
						'bs'
							? 'bg-brand-navy text-white'
							: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
						onclick={() => (baseCurrency = 'bs')}
					>
						Bs
					</button>
					{#each rates as rate (rate.sourceKey)}
						<button
							type="button"
							class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {baseCurrency ===
							rate.sourceKey
								? 'bg-brand-navy text-white'
								: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
							onclick={() => (baseCurrency = rate.sourceKey)}
						>
							{currencyCode(rate.sourceKey)}
						</button>
					{/each}
				</div>

				<!-- Amount input -->
				<div class="relative">
					<input
						type="number"
						min="0"
						step="any"
						bind:value={rawInput}
						placeholder="0.00"
						class="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-14 pl-4 font-mono text-xl font-bold text-brand-navy placeholder:font-normal placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
					/>
					<span
						class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm font-medium text-slate-400"
					>
						{getBsCurrencyLabel()}
					</span>
				</div>
			</div>

			<!-- Results -->
			<div class="divide-y divide-slate-100 border-t border-slate-100 pb-2">
				{#if rates.length === 0}
					<p class="px-5 py-6 text-center text-sm text-slate-400">Tasas no disponibles</p>
				{:else}
					{#each conversions as conv (conv.rate.sourceKey)}
						{@const style = conv.code === 'Bs' ? null : getRateStyle(conv.rate.sourceKey)}
						<div class="flex items-center gap-3 px-4 py-2.5">
							<!-- Icon badge -->
							{#if conv.code === 'Bs'}
								<div
									class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gold/20"
								>
									<span class="text-xs font-bold text-amber-600">Bs</span>
								</div>
							{:else if style?.svgSrc}
								<div
									class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {style.bg}"
								>
									<img src={style.svgSrc} alt={conv.code} class="h-4 w-4" />
								</div>
							{:else if style?.icon}
								{@const Icon = style.icon}
								<div
									class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {style.bg}"
								>
									<Icon size={16} class={style.iconClass} />
								</div>
							{/if}

							<!-- Label -->
							<div class="min-w-0 flex-1">
								<p class="text-sm font-semibold text-brand-navy">{conv.label}</p>
								{#if conv.code !== 'Bs'}
									<p
										class="text-[11px] text-slate-400"
										title="Proveedor actualizó {toRelative(fromISO(conv.rate.lastUpdated))}"
									>
										{toRelativeShort(fromISO(conv.rate.lastUpdated))}
									</p>
								{/if}
							</div>

							<!-- Value -->
							<div class="text-right">
								<span
									class="font-mono text-lg font-bold tabular-nums {conv.value === 0
										? 'text-slate-300'
										: 'text-brand-navy'}"
								>
									{formatValue(conv.value)}
								</span>
								<span class="ml-1 text-[11px] text-slate-400">{conv.code}</span>
							</div>
						</div>
					{/each}
				{/if}
			</div>

			<!-- Rates reference footer -->
			{#if rates.length > 0}
				<div class="border-t border-slate-100 px-5 py-3">
					<p class="mb-2 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
						Tasas actuales
					</p>
					<div class="grid grid-cols-3 gap-2">
						{#each rates as rate (rate.sourceKey)}
							{@const style = getRateStyle(rate.sourceKey)}
							<div class="flex flex-col items-center gap-1 rounded-xl bg-slate-50 px-2 py-2.5">
								<div class="flex h-7 w-7 items-center justify-center rounded-full {style.bg}">
									{#if style.svgSrc}
										<img
											src={style.svgSrc}
											alt={currencyCode(rate.sourceKey)}
											class="h-3.5 w-3.5"
										/>
									{:else if style.icon}
										{@const Icon = style.icon}
										<Icon size={13} class={style.iconClass} />
									{/if}
								</div>
								<span class="text-[11px] font-medium text-slate-500"
									>{currencyCode(rate.sourceKey)}</span
								>
								<span class="font-mono text-sm font-bold text-brand-navy tabular-nums">
									{rate.value.toFixed(2)}
								</span>
								<span class="text-[10px] text-slate-400">Bs</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
