import {
	getExchangeRatesPollIntervalMs,
	isExchangeRatesConfigured,
	refreshExchangeRates
} from './service';
import { notifyRateOutdated, notifyRatesUpdated } from '$lib/server/notifications/service';

let exchangeRatesPoller: ReturnType<typeof setInterval> | null = null;
let lastPollWasStale = false;

async function runExchangeRatesPollCycle() {
	try {
		const snapshot = await refreshExchangeRates({ source: 'poller' });
		const nowStale = snapshot.isStale;

		if (nowStale && !lastPollWasStale) {
			// Transition: healthy → stale
			await notifyRateOutdated({
				lastFetchedAt: snapshot.lastFetchedAt,
				lastError: snapshot.lastError
			});
		} else if (!nowStale && lastPollWasStale) {
			// Transition: stale → healthy
			await notifyRatesUpdated({
				refreshedAt: snapshot.lastFetchedAt ?? new Date().toISOString(),
				updatedKeys: snapshot.rates.map((r) => r.sourceKey)
			});
		}

		lastPollWasStale = nowStale;
	} catch (error) {
		console.error('Error actualizando tasas de cambio', error);
	}
}

export function stopExchangeRatesPoller() {
	if (exchangeRatesPoller) {
		clearInterval(exchangeRatesPoller);
		exchangeRatesPoller = null;
	}
}

export function startExchangeRatesPoller() {
	if (!isExchangeRatesConfigured()) {
		return;
	}

	stopExchangeRatesPoller();

	void refreshExchangeRates({ source: 'startup' }).catch((error) => {
		console.error('Error cargando tasas de cambio al iniciar', error);
	});

	exchangeRatesPoller = setInterval(() => {
		void runExchangeRatesPollCycle();
	}, getExchangeRatesPollIntervalMs());
}
