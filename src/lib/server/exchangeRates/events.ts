import type { ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';
import { logger } from '$lib/utils/logger';

type Listener = (snapshot: ExchangeRatesSnapshot) => void;

type ListenerEntry = {
	send: Listener;
	userId: string | null;
	connectedAt: string;
};

const listeners = new Map<string, ListenerEntry>();

export function onRatesUpdated(
	cid: string,
	listener: Listener,
	userId?: string | null
): () => void {
	listeners.set(cid, {
		send: listener,
		userId: userId ?? null,
		connectedAt: new Date().toISOString()
	});
	logger.info(`SSE client connected cid=${cid} user=${userId ?? '?'} (${listeners.size} total)`);
	return () => {
		const current = listeners.get(cid);
		if (current?.send === listener) {
			listeners.delete(cid);
		}
		logger.info(`SSE client disconnected cid=${cid} (${listeners.size} total)`);
	};
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
		} catch {
			listeners.delete(cid);
		}
	}
}
