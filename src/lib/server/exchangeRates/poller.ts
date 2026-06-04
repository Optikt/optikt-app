import {
	getExchangeRatesPollIntervalMs,
	isExchangeRatesConfigured,
	refreshExchangeRates
} from './service';
import { publishExchangeRatesTransition, syncExchangeRatesHealthState } from './health';

let exchangeRatesPoller: ReturnType<typeof setInterval> | null = null;

async function runExchangeRatesPollCycle() {
	try {
		const snapshot = await refreshExchangeRates({ source: 'poller' });
		await publishExchangeRatesTransition(snapshot);
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

	void refreshExchangeRates({ source: 'startup' })
		.then((snapshot) => {
			syncExchangeRatesHealthState(snapshot);
		})
		.catch((error) => {
			console.error('Error cargando tasas de cambio al iniciar', error);
		});

	exchangeRatesPoller = setInterval(() => {
		void runExchangeRatesPollCycle();
	}, getExchangeRatesPollIntervalMs());
}
