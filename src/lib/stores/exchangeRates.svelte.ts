import { browser } from '$app/environment';
import { resolve } from '$app/paths';
import { refreshExchangeRatesCommand } from '$lib/remote/exchangeRates.remote';
import type { ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';
import { getErrorMessage } from '$lib/utils';

let snapshot = $state<ExchangeRatesSnapshot | null>(null);
let loading = $state(true);
let error = $state<string | null>(null);
let sseConnected = $state(false);

const bcvRate = $derived(snapshot?.rates.find((r) => r.code === 'USD')?.value ?? 0);
const rates = $derived(snapshot?.rates ?? []);

function applySnapshot(next: ExchangeRatesSnapshot) {
	if (snapshot && snapshot.lastFetchedAt === next.lastFetchedAt) return;
	snapshot = next;
	error = null;
}

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
		get sseConnected() {
			return sseConnected;
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

	let eventSource: EventSource | null = null;

	async function load() {
		try {
			const res = await fetch(resolve('/api/exchange-rates'));
			if (!res.ok) throw new Error('Error al cargar tasas');
			applySnapshot(await res.json());
		} catch (e) {
			error = getErrorMessage(e, 'Error al cargar tasas');
		} finally {
			loading = false;
		}
	}

	function connectSSE() {
		eventSource = new EventSource(resolve('/api/exchange-rates/stream'));

		eventSource.onopen = () => {
			sseConnected = true;
		};

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as ExchangeRatesSnapshot;
				applySnapshot(data);
				loading = false;
			} catch {
				// malformed event — ignore
			}
		};

		eventSource.onerror = () => {
			sseConnected = false;
			// EventSource auto-reconnects by default.
			// If it stays in CONNECTING state, fall back to polling.
			if (eventSource?.readyState === EventSource.CONNECTING) {
				setTimeout(connectSSE, 5_000);
			}
		};
	}

	void load();
	connectSSE();

	const pollId = setInterval(load, 60_000);

	return () => {
		clearInterval(pollId);
		eventSource?.close();
		sseConnected = false;
	};
}
