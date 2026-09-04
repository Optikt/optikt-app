import type { ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';
import { logger } from '$lib/utils/logger';

type Listener = (snapshot: ExchangeRatesSnapshot) => void;

const listeners = new Set<Listener>();

export function onRatesUpdated(listener: Listener): () => void {
	listeners.add(listener);
	logger.info(`SSE client connected (${listeners.size} total)`);
	return () => {
		listeners.delete(listener);
		logger.info(`SSE client disconnected (${listeners.size} total)`);
	};
}

export function emitRatesUpdated(snapshot: ExchangeRatesSnapshot): void {
	if (listeners.size === 0) return;
	logger.info(
		`Emitting rate update to ${listeners.size} SSE client(s) — lastFetchedAt: ${snapshot.lastFetchedAt}`
	);
	for (const listener of listeners) {
		listener(snapshot);
	}
}
