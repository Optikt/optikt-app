<script lang="ts">
	import { untrack } from 'svelte';
	import { CircleDollarSign, Copy, RefreshCw, TriangleAlert } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';
	import {
		fetchExchangeRates,
		refreshExchangeRatesCommand
	} from '$lib/remote/exchangeRates.remote';
	import { fromISO, toRelative } from '$lib/dates';
	import { getErrorMessage } from '$lib/utils';
	import type { ExchangeRateEntry, ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';

	let open = $state(false);
	let loading = $state(true);
	let refreshing = $state(false);
	let tick = $state(0);
	let snapshot = $state<ExchangeRatesSnapshot | null>(null);
	let loadError = $state<string | null>(null);

	const rates = $derived(snapshot?.rates ?? []);

	function getFooterLabel(currentSnapshot: ExchangeRatesSnapshot | null, _tick: number) {
		if (!currentSnapshot) {
			return 'Cargando tasas...';
		}

		if (!currentSnapshot.configured) {
			return 'API de tasas no configurada';
		}

		if (currentSnapshot.lastFetchedAt) {
			return `Actualizadas ${toRelative(fromISO(currentSnapshot.lastFetchedAt))}`;
		}

		return currentSnapshot.lastError ?? 'Sin actualizaciones recientes';
	}

	const footerLabel = $derived.by(() => {
		return getFooterLabel(snapshot, tick);
	});

	async function loadRates(options: { silent?: boolean; imperative?: boolean } = {}) {
		const { silent = false, imperative = false } = options;

		if (!silent && !snapshot) {
			loading = true;
		}

		try {
			snapshot = imperative ? await fetchExchangeRates().run() : await fetchExchangeRates();
			loadError = null;
		} catch (error) {
			loadError = getErrorMessage(error, 'No se pudieron cargar las tasas');
			if (!silent) {
				console.error(error);
				toast.error(loadError);
			}
		} finally {
			loading = false;
		}
	}

	async function handleRefresh(event: MouseEvent) {
		event.stopPropagation();
		refreshing = true;

		try {
			snapshot = await refreshExchangeRatesCommand({});
			loadError = null;
			toast.success('Tasas actualizadas');
		} catch (error) {
			console.error(error);
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
		if (open && !snapshot) {
			void loadRates({ imperative: true });
		}
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

	$effect(() => {
		untrack(() => void loadRates());

		const refreshInterval = window.setInterval(() => {
			void loadRates({ silent: true, imperative: true });
		}, 60_000);

		const clockInterval = window.setInterval(() => {
			tick += 1;
		}, 30_000);

		return () => {
			window.clearInterval(refreshInterval);
			window.clearInterval(clockInterval);
		};
	});
</script>

<svelte:document onclick={handleClickOutside} />

<div class="relative" data-exchange-rates>
	<button
		type="button"
		class="rounded p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
		onclick={toggle}
		title="Tasas de cambio"
		aria-expanded={open}
		aria-label="Abrir tasas de cambio"
	>
		<CircleDollarSign size={20} />
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
		>
			<div class="flex items-center justify-between border-b border-slate-100 px-4 py-3">
				<div>
					<h3 class="text-sm font-semibold text-brand-navy">Tasas de cambio</h3>
					<p class="mt-0.5 text-[11px] text-slate-400">
						Fuente externa sincronizada en segundo plano
					</p>
				</div>
				<button
					type="button"
					class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handleRefresh}
					disabled={refreshing}
					title="Refrescar tasas"
				>
					<RefreshCw class={refreshing ? 'animate-spin' : ''} size={14} />
				</button>
			</div>

			{#if loading && !snapshot}
				<div class="space-y-2 p-3">
					{#each [1, 2, 3] as row (row)}
						<div class="flex items-center justify-between rounded-lg px-3 py-2.5">
							<div class="h-4 w-24 animate-pulse rounded bg-slate-100"></div>
							<div class="h-4 w-20 animate-pulse rounded bg-slate-100"></div>
						</div>
					{/each}
				</div>
			{:else if rates.length > 0}
				<div class="divide-y divide-slate-100 p-2">
					{#each rates as rate (rate.sourceKey)}
						<div
							class="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-slate-50"
						>
							<div class="min-w-0">
								<p class="text-sm font-medium text-slate-700">{rate.label}</p>
								<p class="mt-0.5 text-[11px] text-slate-400">
									Proveedor actualizó {toRelative(fromISO(rate.lastUpdated))}
								</p>
							</div>
							<div class="flex items-center gap-2 pl-3">
								<span class="font-mono text-sm font-semibold text-brand-navy tabular-nums">
									{formatRate(rate.value)}
									<span class="ml-1 text-[11px] font-normal text-slate-400">Bs</span>
								</span>
								<button
									type="button"
									class="rounded p-1 text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
									title={`Copiar ${rate.label}`}
									onclick={(event) => handleCopy(rate, event)}
								>
									<Copy size={12} />
								</button>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="px-4 py-5">
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
								{loadError ??
									snapshot?.lastError ??
									'Todavía no hay datos cargados desde la API externa.'}
							</p>
						</div>
					</div>
				</div>
			{/if}

			<div class="border-t border-slate-100 px-4 py-2.5">
				<p class="text-xs text-slate-400">{footerLabel}</p>
				{#if snapshot?.isStale}
					<p class="mt-1 text-[11px] font-medium text-amber-600">Podrían estar desactualizadas.</p>
				{/if}
			</div>
		</div>
	{/if}
</div>
