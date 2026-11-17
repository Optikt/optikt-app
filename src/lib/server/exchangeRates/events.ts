import type { ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';
import { logger } from '$lib/utils/logger';

type Listener = (snapshot: ExchangeRatesSnapshot) => void;

type ListenerEntry = {
	send: Listener;
	/** Closes the controller + clears its keepalive (owned by the stream endpoint). */
	close: () => void;
	userId: string | null;
	connectedAt: string;
	/** Epoch ms of the last successful ping/emit; stale entries get swept. */
	lastPing: number;
};

/** Hard cap on concurrent SSE listeners; new connections above it get a 429. */
export const SSE_MAX_LISTENERS = 500;
/** An entry whose lastPing is older than this is considered dead and swept. */
const SSE_IDLE_TIMEOUT_MS = 90_000;
const SWEEP_INTERVAL_MS = 30_000;

const listeners = new Map<string, ListenerEntry>();

let sweeper: ReturnType<typeof setInterval> | null = null;

function startSweeper(): void {
	if (sweeper) return;
	sweeper = setInterval(sweepIdleListeners, SWEEP_INTERVAL_MS);
	// Don't keep the process alive just for the sweep.
	sweeper.unref?.();
}

/** Stops the idle sweep — exposed for tests. */
export function stopSseSweeper(): void {
	if (sweeper) {
		clearInterval(sweeper);
		sweeper = null;
	}
}

/** Drops every listener without closing streams — test-only reset. */
export function clearSseListeners(): void {
	listeners.clear();
}

function sweepIdleListeners(): void {
	const now = Date.now();
	for (const [cid, entry] of listeners) {
		if (now - entry.lastPing > SSE_IDLE_TIMEOUT_MS) {
			listeners.delete(cid);
			logger.info(`SSE client disconnected cid=${cid} reason=timeout (${listeners.size} total)`);
			try {
				entry.close();
			} catch {
				// controller already closed
			}
		}
	}
}

/**
 * Whether the registry can accept another listener for `cid`.
 * Reconnections with the same cid always fit (they replace the old entry).
 */
export function hasSseCapacity(cid: string): boolean {
	return listeners.size < SSE_MAX_LISTENERS || listeners.has(cid);
}

export function onRatesUpdated(
	cid: string,
	listener: Listener,
	close: () => void,
	userId?: string | null
): () => void {
	startSweeper();
	// Same-cid reconnect replaces the old entry instead of growing the registry.
	listeners.set(cid, {
		send: listener,
		close,
		userId: userId ?? null,
		connectedAt: new Date().toISOString(),
		lastPing: Date.now()
	});
	logger.info(`SSE client connected cid=${cid} user=${userId ?? '?'} (${listeners.size} total)`);
	return () => {
		const current = listeners.get(cid);
		if (current?.send === listener) {
			listeners.delete(cid);
			logger.info(`SSE client disconnected cid=${cid} reason=abort (${listeners.size} total)`);
		}
	};
}

/** Marks the listener as alive — call after each successful enqueue. */
export function touchListener(cid: string): void {
	const entry = listeners.get(cid);
	if (entry) entry.lastPing = Date.now();
}

export function getSseListenerCount(): number {
	return listeners.size;
}

export function emitRatesUpdated(snapshot: ExchangeRatesSnapshot): void {
	if (listeners.size === 0) return;
	logger.info(
		`Emitting rate update to ${listeners.size} SSE client(s) — lastFetchedAt: ${snapshot.lastFetchedAt}`
	);
	for (const [cid, entry] of listeners) {
		try {
			entry.send(snapshot);
			entry.lastPing = Date.now();
		} catch {
			listeners.delete(cid);
			try {
				entry.close();
			} catch {
				// controller already closed
			}
		}
	}
}
