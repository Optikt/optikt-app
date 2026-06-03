import {
	getExchangeRatesPollIntervalMs,
	isExchangeRatesConfigured,
	refreshExchangeRates
} from './service';
import { notifyRateOutdated } from '$lib/server/notifications/service';

let exchangeRatesPoller: ReturnType<typeof setInterval> | null = null;

async function runExchangeRatesPollCycle() {
	try {
		const snapshot = await refreshExchangeRates({ source: 'poller' });
		if (snapshot.isStale) {
			await notifyRateOutdated({
				lastFetchedAt: snapshot.lastFetchedAt,
				lastError: snapshot.lastError
			});
		}
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
