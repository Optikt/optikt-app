import {
	getExchangeRatesPollIntervalMs,
	getExchangeRatesSnapshot,
	isExchangeRatesConfigured,
	refreshExchangeRates
} from './service';
import { emitRatesUpdated } from './events';
import { publishExchangeRatesTransition, syncExchangeRatesHealthState } from './health';
import { logger } from '$lib/utils/logger';

let exchangeRatesPoller: ReturnType<typeof setInterval> | null = null;

async function runExchangeRatesPollCycle() {
	try {
		const snapshot = await refreshExchangeRates({ source: 'poller' });
		await publishExchangeRatesTransition(snapshot);
		emitRatesUpdated(snapshot);
		logger.info(
			`Poller tasas ok lastFetchedAt=${snapshot.lastFetchedAt} isStale=${snapshot.isStale} lastError=${snapshot.lastError ?? 'none'}`
		);
	} catch (error) {
		logger.error('Error actualizando tasas de cambio', error);
		emitRatesUpdated(getExchangeRatesSnapshot());
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

	void refreshExchangeRates({ source: 'startup' })
		.then((snapshot) => {
			syncExchangeRatesHealthState(snapshot);
			emitRatesUpdated(snapshot);
			logger.info(
				`Poller tasas startup ok lastFetchedAt=${snapshot.lastFetchedAt} isStale=${snapshot.isStale} intervalMs=${getExchangeRatesPollIntervalMs()}`
			);
		})
		.catch((error) => {
			logger.error('Error cargando tasas de cambio al iniciar', error);
			emitRatesUpdated(getExchangeRatesSnapshot());
		});

	exchangeRatesPoller = setInterval(() => {
		void runExchangeRatesPollCycle();
	}, getExchangeRatesPollIntervalMs());
}
