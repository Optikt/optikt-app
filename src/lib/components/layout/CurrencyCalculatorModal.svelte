<script lang="ts">
	import { DollarSign, Euro, Pen, RefreshCw, TriangleAlert, X } from '@lucide/svelte';
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

	// --- Tasa personalizada ---
	const CUSTOM_SOURCE_KEY = '__custom__';
	const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

	type SavedCustomRate = {
		value: number;
		label: string;
		timestamp: number;
	};

	let showCustomInput = $state(false);
	let customRateInput = $state('');
	let customLabelInput = $state('');
	let savedRate = $state<SavedCustomRate | null>(null);

	function loadSavedRate() {
		try {
			const raw = localStorage.getItem('calc-custom-rate');
			if (raw) savedRate = JSON.parse(raw);
		} catch {
			/* ignore */
		}
	}

	function saveCustomRate(rate: SavedCustomRate) {
		savedRate = rate;
		localStorage.setItem('calc-custom-rate', JSON.stringify(rate));
	}

	function clearCustomRate() {
		if (baseCurrency === CUSTOM_SOURCE_KEY) baseCurrency = 'bs';
		savedRate = null;
		localStorage.removeItem('calc-custom-rate');
	}

	function applyCustomRate() {
		const val = parseFloat(customRateInput);
		if (!val || val <= 0) return;
		saveCustomRate({ value: val, label: customLabelInput.trim(), timestamp: Date.now() });
		showCustomInput = false;
		customRateInput = '';
		customLabelInput = '';
	}

	function dismissCustomStale() {
		if (savedRate) saveCustomRate({ ...savedRate, timestamp: Date.now() });
	}

	const isCustomStale = $derived(
		savedRate ? Date.now() - savedRate.timestamp > SIX_HOURS_MS : false
	);

	const customVirtualRate = $derived.by((): (ExchangeRateEntry & { isCustom: boolean }) | null => {
		if (!savedRate || savedRate.value <= 0) return null;
		const ageSec = Math.floor((Date.now() - savedRate.timestamp) / 1000);
		return {
			sourceKey: CUSTOM_SOURCE_KEY,
			code: savedRate.label ? savedRate.label.substring(0, 5).toUpperCase() : 'TASA',
			label: savedRate.label || 'Mi tasa',
			value: savedRate.value,
			dataAgeSeconds: ageSec,
			isStale: isCustomStale,
			lastUpdated: new Date(savedRate.timestamp).toISOString(),
			isCustom: true
		};
	});

	const allRates = $derived(customVirtualRate ? [...rates, customVirtualRate] : rates);

	$effect(() => {
		loadSavedRate();
	});

	// Short currency code from sourceKey (usd_bcv → USD, usdt_binance → USDT)
	function currencyCode(sourceKey: string): string {
		if (sourceKey === CUSTOM_SOURCE_KEY)
			return savedRate?.label ? savedRate.label.substring(0, 5).toUpperCase() : 'TASA';
		return sourceKey.split('_')[0].toUpperCase();
	}

	// Distinctive short label for selector buttons (differentiates USDT variants)
	function buttonLabel(sourceKey: string): string {
		if (sourceKey === '__custom__') return savedRate?.label || 'Tasa';
		if (sourceKey === 'usdt') return 'USDT';
		if (sourceKey === 'usdt_compra') return 'USDT Compra';
		if (sourceKey === 'usdt_venta') return 'USDT Venta';
		return currencyCode(sourceKey);
	}

	type ConversionResult = {
		rate: ExchangeRateEntry;
		label: string;
		code: string;
		value: number;
	};

	// All conversion results given current amount and base
	const conversions = $derived.by((): ConversionResult[] => {
		if (allRates.length === 0) return [];

		if (baseCurrency === 'bs') {
			return allRates.map((rate) => ({
				rate,
				label: rate.label,
				code: currencyCode(rate.sourceKey),
				value: amount > 0 ? amount / rate.value : 0
			}));
		}

		const selectedRate = allRates.find((r) => r.sourceKey === baseCurrency);
		if (!selectedRate) return [];

		const bsAmount = amount * selectedRate.value;

		return allRates
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
		if (sourceKey === '__custom__')
			return { bg: 'bg-amber-100', iconClass: 'text-amber-600', icon: Pen };
		if (sourceKey.startsWith('eur'))
			return { bg: 'bg-indigo-100', iconClass: 'text-indigo-500', icon: Euro };
		if (sourceKey.includes('usdt') || sourceKey.includes('binance'))
			return { bg: 'bg-[#53ae94]/15', iconClass: 'text-[#53ae94]', svgSrc: '/tether.svg' };
		return { bg: 'bg-brand-blue/15', iconClass: 'text-brand-blue', icon: DollarSign };
	}

	function getBsCurrencyLabel(): string {
		if (baseCurrency === 'bs') return 'Bs';
		if (baseCurrency === CUSTOM_SOURCE_KEY) return savedRate?.label || 'Tasa';
		const rate = allRates.find((r) => r.sourceKey === baseCurrency);
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
</script>

{#if open}
	<div
		role="presentation"
		class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
		onkeydown={handleKeydown}
	>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="calc-modal-title"
			class="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20"
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
				<div class="mb-3 flex flex-wrap gap-1.5">
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
					{#each allRates as rate (rate.sourceKey)}
						<button
							type="button"
							class="rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors {baseCurrency ===
							rate.sourceKey
								? 'bg-brand-navy text-white'
								: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
							onclick={() => (baseCurrency = rate.sourceKey)}
						>
							{buttonLabel(rate.sourceKey)}
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

			<!-- Custom rate section -->
			<div class="border-t border-slate-100 px-5 pt-3 pb-2">
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					role="button"
					tabindex="0"
					class="flex w-full cursor-pointer items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-800"
					onclick={() => (showCustomInput = !showCustomInput)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') showCustomInput = !showCustomInput;
					}}
				>
					<svg
						class="h-3.5 w-3.5 transition-transform {showCustomInput ? 'rotate-90' : ''}"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"><path d="m9 18 6-6-6-6" /></svg
					>
					Tasa personalizada
					{#if savedRate}
						<span class="ml-auto flex items-center gap-1">
							<span class="text-xs font-normal text-slate-400">
								{savedRate.label || 'Tasa'}: {savedRate.value} Bs
							</span>
							{#if isCustomStale}
								<span
									class="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600"
									title="Guardada hace más de 6 horas. Verifica que siga vigente."
								>
									<TriangleAlert size={11} />
								</span>
								<button
									type="button"
									class="flex h-5 w-5 items-center justify-center rounded text-amber-500 transition-colors hover:bg-amber-100"
									onclick={(e) => {
										e.stopPropagation();
										dismissCustomStale();
									}}
									title="Descartar aviso — reinicia contador de 6h"
									aria-label="Descartar aviso de tasa desactualizada"
								>
									<svg
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										class="h-3 w-3"
										><path d="M20 12a8 8 0 1 1-8-8" /><path d="M12 2v4l3-3-3-3" /></svg
									>
								</button>
							{/if}
							<button
								type="button"
								class="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-slate-300 transition-colors hover:text-red-500"
								onclick={(e) => {
									e.stopPropagation();
									clearCustomRate();
								}}
								aria-label="Eliminar tasa personalizada"
							>
								<svg
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									class="h-3 w-3"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg
								>
							</button>
						</span>
					{:else}
						<span class="ml-auto text-xs text-slate-400">Añadir</span>
					{/if}
				</div>
				{#if showCustomInput}
					<div class="mt-2 space-y-2">
						<div class="flex gap-2">
							<input
								type="number"
								min="0"
								step="any"
								bind:value={customRateInput}
								placeholder="Valor en Bs"
								class="w-28 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-sm text-brand-navy placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
							/>
							<input
								type="text"
								bind:value={customLabelInput}
								placeholder="Etiqueta (ej: PayPal)"
								class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm text-brand-navy placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-2 focus:ring-brand-blue/15 focus:outline-none"
							/>
							<button
								type="button"
								class="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-blue/90 disabled:cursor-not-allowed disabled:opacity-50"
								onclick={applyCustomRate}
								disabled={!customRateInput || parseFloat(customRateInput) <= 0}
							>
								Aplicar
							</button>
						</div>
					</div>
				{/if}
			</div>

			<div class="flex-1 overflow-y-auto">
				<!-- Results -->
				<div class="divide-y divide-slate-100 border-t border-slate-100 pb-1">
					{#if allRates.length === 0}
						<p class="px-5 py-6 text-center text-sm text-slate-400">Tasas no disponibles</p>
					{:else}
						{#each conversions as conv (conv.rate.sourceKey)}
							{@const style = conv.code === 'Bs' ? null : getRateStyle(conv.rate.sourceKey)}
							{@const isCustom = conv.rate.sourceKey === '__custom__'}
							<div
								class="flex items-center gap-2 px-3 py-2 {isCustom
									? 'rounded-lg border-l-2 pl-3.5 ' +
										(isCustomStale ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200')
									: ''}"
								title={isCustom && isCustomStale
									? 'Guardada hace más de 6 horas. Puede estar desactualizada.'
									: ''}
							>
								<!-- Icon badge -->
								{#if conv.code === 'Bs'}
									<div
										class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-gold/20"
									>
										<span class="text-xs font-bold text-amber-600">Bs</span>
									</div>
								{:else if style?.svgSrc}
									<div
										class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {style.bg}"
									>
										<img src={style.svgSrc} alt={conv.code} class="h-3.5 w-3.5" />
									</div>
								{:else if style?.icon}
									{@const Icon = style.icon}
									<div
										class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full {style.bg}"
									>
										<Icon size={14} class={style.iconClass} />
									</div>
								{/if}

								<!-- Label -->
								<div class="min-w-0 flex-1">
									<p class="text-sm font-semibold text-brand-navy">{conv.label}</p>
									{#if conv.code !== 'Bs'}
										<p
											class="text-[11px] text-slate-400"
											title={isCustom
												? 'Tasa personalizada guardada en el navegador'
												: 'Proveedor actualizó ' + toRelative(fromISO(conv.rate.lastUpdated))}
										>
											{isCustom
												? 'Tasa personalizada'
												: toRelativeShort(fromISO(conv.rate.lastUpdated))}
										</p>
									{/if}
								</div>

								<!-- Value -->
								<div class="flex items-center gap-1.5 text-right">
									{#if isCustom && isCustomStale}
										<button
											type="button"
											class="flex h-6 w-6 items-center justify-center rounded text-amber-400 transition-colors hover:bg-amber-100 hover:text-amber-600"
											onclick={dismissCustomStale}
											title="Reiniciar contador de 6h"
											aria-label="Descartar aviso de actualización"
										>
											<svg
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
												class="h-3.5 w-3.5"
												><path d="M20 12a8 8 0 1 1-8-8" /><path d="M12 2v4l3-3-3-3" /></svg
											>
										</button>
									{/if}
									<div>
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
							</div>
						{/each}
					{/if}
				</div>

				<!-- Rates reference footer -->
				{#if allRates.length > 0}
					<div class="border-t border-slate-100 px-4 py-2.5">
						<p class="mb-1.5 text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
							Tasas actuales
						</p>
						<div class="grid grid-cols-3 gap-1.5">
							{#each allRates as rate (rate.sourceKey)}
								{@const style = getRateStyle(rate.sourceKey)}
								<div
									class="flex flex-col items-center gap-0.5 rounded-xl bg-slate-50 px-1.5 py-1.5"
								>
									<div class="flex h-6 w-6 items-center justify-center rounded-full {style.bg}">
										{#if style.svgSrc}
											<img src={style.svgSrc} alt={buttonLabel(rate.sourceKey)} class="h-3 w-3" />
										{:else if style.icon}
											{@const Icon = style.icon}
											<Icon size={11} class={style.iconClass} />
										{/if}
									</div>
									<span class="text-[10px] font-medium text-slate-500"
										>{buttonLabel(rate.sourceKey)}</span
									>
									<span class="font-mono text-xs font-bold text-brand-navy tabular-nums">
										{rate.value.toFixed(2)}
									</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
