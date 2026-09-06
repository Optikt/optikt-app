import { browser } from '$app/environment';
import { resolve } from '$app/paths';
import { refreshExchangeRatesCommand } from '$lib/remote/exchangeRates.remote';
import type { ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';
import { getErrorMessage } from '$lib/utils';

let snapshot = $state<ExchangeRatesSnapshot | null>(null);
let loading = $state(true);
let error = $state<string | null>(null);
let sseConnected = $state(false);
let lastUpdateSource = $state<'sse' | 'poll' | 'manual' | null>(null);

const bcvRate = $derived(snapshot?.rates.find((r) => r.code === 'USD')?.value ?? 0);
const rates = $derived(snapshot?.rates ?? []);

function applySnapshot(next: ExchangeRatesSnapshot, source?: 'sse' | 'poll') {
	if (snapshot && snapshot.lastFetchedAt === next.lastFetchedAt) return;
	snapshot = next;
	error = null;
	if (source) lastUpdateSource = source;
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
		get lastUpdateSource() {
			return lastUpdateSource;
		},
		async refresh() {
			try {
				lastUpdateSource = 'manual';
				snapshot = await refreshExchangeRatesCommand({});
				error = null;
			} catch (e) {
				error = getErrorMessage(e, 'Error al actualizar tasas');
				throw e;
			}
		}
	};
}

const SSE_CID_KEY = 'exchangeRatesSseCid';
let singletonES: EventSource | null = null;
let singletonPollId: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let pollingActive = false;

function getOrCreateCid(): string {
	try {
		const existing = sessionStorage.getItem(SSE_CID_KEY);
		if (existing) return existing;
		const cid = crypto.randomUUID();
		sessionStorage.setItem(SSE_CID_KEY, cid);
		return cid;
	} catch {
		return crypto.randomUUID();
	}
}

export function initExchangeRatesPolling() {
	if (!browser) return;
	if (pollingActive) return () => {};
	pollingActive = true;

	const cid = getOrCreateCid();

	async function load() {
		try {
			const res = await fetch(resolve('/api/exchange-rates'));
			if (!res.ok) throw new Error('Error al cargar tasas');
			applySnapshot(await res.json(), 'poll');
		} catch (e) {
			error = getErrorMessage(e, 'Error al cargar tasas');
		} finally {
			loading = false;
		}
	}

	function scheduleReconnect() {
		if (reconnectTimer) return;
		const backoff = Math.min(30_000, 1_000 * 2 ** reconnectAttempts + Math.random() * 500);
		reconnectAttempts += 1;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			connectSSE();
		}, backoff);
	}

	function connectSSE() {
		if (singletonES && singletonES.readyState <= 1) return;
		try {
			singletonES?.close();
		} catch {
			// already closed
		}
		singletonES = new EventSource(
			resolve(`/api/exchange-rates/stream?cid=${encodeURIComponent(cid)}`)
		);

		singletonES.onopen = () => {
			sseConnected = true;
			reconnectAttempts = 0;
		};

		singletonES.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as ExchangeRatesSnapshot;
				applySnapshot(data, 'sse');
				loading = false;
			} catch {
				// malformed event — ignore
			}
		};

		singletonES.onerror = () => {
			sseConnected = false;
			try {
				singletonES?.close();
			} catch {
				// already closed
			}
			singletonES = null;
			scheduleReconnect();
		};
	}

	void load();
	connectSSE();

	if (!singletonPollId) {
		singletonPollId = setInterval(load, 60_000);
	}

	function cleanup() {
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		if (singletonPollId) {
			clearInterval(singletonPollId);
			singletonPollId = null;
		}
		try {
			singletonES?.close();
		} catch {
			// already closed
		}
		singletonES = null;
		pollingActive = false;
		sseConnected = false;
	}

	window.addEventListener('pagehide', cleanup, { once: true });

	return cleanup;
}
