<script lang="ts">
	import {
		Calculator,
		CircleDollarSign,
		Copy,
		DollarSign,
		Euro,
		RefreshCw,
		TriangleAlert,
		X
	} from '@lucide/svelte';
	import type { Component } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { getExchangeRatesStore } from '$lib/stores/exchangeRates.svelte';
	import { fromISO, toRelative, toRelativeShort } from '$lib/dates';
	import { getErrorMessage } from '$lib/utils';
	import type { ExchangeRateEntry } from '$lib/shared/exchangeRates';
	import CurrencyCalculatorModal from './CurrencyCalculatorModal.svelte';

	const store = getExchangeRatesStore();

	const rates = $derived(store.rates);

	let open = $state(false);
	let calcOpen = $state(false);
	let refreshing = $state(false);
	let tick = $state(0);

	function getFooterLabel(_tick: number) {
		if (!store.snapshot) {
			return 'Cargando tasas...';
		}

		if (!store.configured) {
			return 'API de tasas no configurada';
		}

		if (store.lastFetchedAt) {
			return `Actualizadas ${toRelative(fromISO(store.lastFetchedAt))}`;
		}

		return store.lastError ?? 'Sin actualizaciones recientes';
	}

	const footerLabel = $derived.by(() => {
		return getFooterLabel(tick);
	});

	async function handleRefresh(event: MouseEvent) {
		event.stopPropagation();
		refreshing = true;

		try {
			await store.refresh();
			toast.success('Tasas actualizadas');
		} catch (error) {
			toast.error(getErrorMessage(error, 'No se pudieron actualizar las tasas'));
		} finally {
			refreshing = false;
		}
	}

	async function handleCopy(rate: ExchangeRateEntry, event: MouseEvent) {
		event.stopPropagation();

		if (!navigator.clipboard) {
			toast.error('Copiado automático no disponible');
			return;
		}

		await navigator.clipboard.writeText(rate.value.toFixed(2));
		toast.success(`Tasa ${rate.label} copiada`);
	}

	function toggle() {
		open = !open;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('[data-exchange-rates]')) {
			open = false;
		}
	}

	function formatRate(value: number) {
		return value.toFixed(2);
	}

	type RateStyle = { bg: string; text: string; icon?: Component; svgSrc?: string };

	function getRateStyle(sourceKey: string): RateStyle {
		if (sourceKey.startsWith('eur'))
			return { bg: 'bg-indigo-100', text: 'text-indigo-500', icon: Euro };
		if (sourceKey.includes('usdt') || sourceKey.includes('binance'))
			return { bg: 'bg-[#53ae94]/15', text: 'text-[#53ae94]', svgSrc: '/tether.svg' };
		return { bg: 'bg-brand-blue/15', text: 'text-brand-blue', icon: DollarSign };
	}

	$effect(() => {
		const clockInterval = window.setInterval(() => {
			tick += 1;
		}, 30_000);

		return () => {
			window.clearInterval(clockInterval);
		};
	});
</script>

<svelte:document onclick={handleClickOutside} />

<div class="relative" data-exchange-rates>
	<button
		type="button"
		class="inline-flex h-9 w-9 items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:h-10 sm:w-10"
		onclick={toggle}
		title="Tasas de cambio"
		aria-expanded={open}
		aria-haspopup="dialog"
		aria-label="Abrir tasas de cambio"
	>
		<CircleDollarSign size={20} />
	</button>

	{#if open}
		<button
			type="button"
			class="fixed inset-0 z-[55] bg-brand-navy/30 backdrop-blur-[1px] md:hidden"
			onclick={() => (open = false)}
			aria-label="Cerrar panel de tasas de cambio"
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-labelledby="exchange-rates-title"
			class="fixed inset-x-3 top-[6.25rem] bottom-4 z-[60] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 md:absolute md:top-full md:right-0 md:bottom-auto md:left-auto md:z-50 md:mt-2 md:max-h-[32rem] md:w-80 md:rounded-xl md:shadow-lg"
		>
			<div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
				<div>
					<h3 id="exchange-rates-title" class="text-sm font-semibold text-brand-navy">
						Tasas de cambio
					</h3>
					<p class="mt-0.5 text-[11px] text-slate-400">
						Fuente externa sincronizada en segundo plano
					</p>
				</div>
				<div class="flex items-center gap-1.5">
					<button
						type="button"
						class="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue/10 text-brand-blue transition-colors hover:bg-brand-blue/20 disabled:cursor-not-allowed disabled:opacity-50"
						onclick={handleRefresh}
						disabled={refreshing}
						title="Refrescar tasas"
					>
						<RefreshCw class={refreshing ? 'animate-spin' : ''} size={14} />
					</button>
					<button
						type="button"
						class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 md:hidden"
						onclick={() => (open = false)}
						aria-label="Cerrar tasas de cambio"
					>
						<X size={16} />
					</button>
				</div>
			</div>

			{#if store.loading && !store.snapshot}
				<div class="flex-1 space-y-1 overflow-y-auto p-3">
					{#each [1, 2, 3] as row (row)}
						<div class="flex items-center gap-3 rounded-xl px-3 py-2.5">
							<div class="h-10 w-10 animate-pulse rounded-full bg-slate-100"></div>
							<div class="flex-1 space-y-1.5">
								<div class="h-3.5 w-24 animate-pulse rounded bg-slate-100"></div>
								<div class="h-3 w-32 animate-pulse rounded bg-slate-100"></div>
							</div>
							<div class="h-7 w-20 animate-pulse rounded bg-slate-100"></div>
						</div>
					{/each}
				</div>
			{:else if rates.length > 0}
				<div class="flex-1 divide-y divide-slate-100 overflow-y-auto p-2">
					{#each rates as rate (rate.sourceKey)}
						{@const style = getRateStyle(rate.sourceKey)}
						<div
							class="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
						>
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full {style.bg}"
							>
								{#if style.svgSrc}
									<img src={style.svgSrc} alt="Tether" class="h-5 w-5" />
								{:else if style.icon}
									{@const Icon = style.icon}
									<Icon size={18} class={style.text} />
								{/if}
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-semibold text-brand-navy">{rate.label}</p>
								<p
									class="mt-0.5 text-[11px] text-slate-400"
									title="Proveedor actualizó {toRelative(fromISO(rate.lastUpdated))}"
								>
									{toRelativeShort(fromISO(rate.lastUpdated))}
								</p>
							</div>
							<div class="flex w-28 shrink-0 items-center justify-end gap-0.5">
								<div class="text-right">
									<span class="font-mono text-xl font-bold text-brand-navy tabular-nums"
										>{formatRate(rate.value)}</span
									>
									<span class="ml-1 text-[11px] text-slate-400">Bs</span>
								</div>
								<button
									type="button"
									class="ml-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-brand-blue/10 hover:text-brand-blue"
									title="Copiar {rate.label}"
									onclick={(event) => handleCopy(rate, event)}
								>
									<Copy size={13} />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="flex-1 overflow-y-auto px-4 py-5">
					<div
						class="flex items-start gap-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3"
					>
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600"
						>
							<TriangleAlert size={14} />
						</div>
						<div class="min-w-0">
							<p class="text-sm font-medium text-slate-800">Tasas no disponibles</p>
							<p class="mt-0.5 text-xs leading-relaxed text-slate-500">
								{store.error ??
									store.lastError ??
									'Todavía no hay datos cargados desde la API externa.'}
							</p>
						</div>
					</div>
				</div>
			{/if}

			<div class="flex shrink-0 items-center justify-between border-t border-slate-100 px-4 py-2.5">
				<div>
					<p class="text-xs text-slate-400">{footerLabel}</p>
					{#if store.isStale}
						<p class="mt-1 text-[11px] font-medium text-amber-600">
							Podrían estar desactualizadas.
						</p>
					{/if}
				</div>
				{#if rates.length > 0}
					<button
						type="button"
						class="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-blue transition-colors hover:bg-brand-blue/10"
						onclick={() => {
							open = false;
							calcOpen = true;
						}}
					>
						<Calculator size={13} />
						Calcular
					</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<CurrencyCalculatorModal
	bind:open={calcOpen}
	snapshot={store.snapshot}
	{refreshing}
	onClose={() => (calcOpen = false)}
	onRefresh={handleRefresh}
/>
