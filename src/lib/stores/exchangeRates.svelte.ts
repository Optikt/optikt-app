import { browser } from '$app/environment';
import { resolve } from '$app/paths';
import { refreshExchangeRatesCommand } from '$lib/remote/exchangeRates.remote';
import type { ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';
import { getErrorMessage } from '$lib/utils';

let snapshot = $state<ExchangeRatesSnapshot | null>(null);
let loading = $state(true);
let error = $state<string | null>(null);

const bcvRate = $derived(snapshot?.rates.find((r) => r.code === 'USD')?.value ?? 0);
const rates = $derived(snapshot?.rates ?? []);

export function getExchangeRatesStore() {
	return {
		get snapshot() {
			return snapshot;
		},
		get loading() {
			return loading;
		},
		get error() {
			return error;
		},
		get bcvRate() {
			return bcvRate;
		},
		get rates() {
			return rates;
		},
		get lastFetchedAt() {
			return snapshot?.lastFetchedAt ?? null;
		},
		get isStale() {
			return snapshot?.isStale ?? false;
		},
		get configured() {
			return snapshot?.configured ?? false;
		},
		get lastError() {
			return snapshot?.lastError ?? null;
		},
		async refresh() {
			try {
				snapshot = await refreshExchangeRatesCommand({});
				error = null;
			} catch (e) {
				error = getErrorMessage(e, 'Error al actualizar tasas');
				throw e;
			}
		}
	};
}

export function initExchangeRatesPolling() {
	if (!browser) return;

	async function load() {
		try {
			const res = await fetch(resolve('/api/exchange-rates'));
			if (!res.ok) throw new Error('Error al cargar tasas');
			snapshot = await res.json();
			error = null;
		} catch (e) {
			error = getErrorMessage(e, 'Error al cargar tasas');
		} finally {
			loading = false;
		}
	}

	void load();
	const id = setInterval(load, 60_000);
	return () => clearInterval(id);
}
