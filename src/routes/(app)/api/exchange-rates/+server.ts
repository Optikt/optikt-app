import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getExchangeRatesSnapshot, refreshExchangeRates } from '$lib/server/exchangeRates/service';
import { emitRatesUpdated } from '$lib/server/exchangeRates/events';
import { publishExchangeRatesTransition } from '$lib/server/exchangeRates/health';

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'No autorizado');
	}

	const snapshot = getExchangeRatesSnapshot();
	if (snapshot.configured && snapshot.rates.length === 0 && !snapshot.lastFetchedAt) {
		const nextSnapshot = await refreshExchangeRates({ source: 'lazy' });
		await publishExchangeRatesTransition(nextSnapshot);
		emitRatesUpdated(nextSnapshot);
		return json(nextSnapshot);
	}

	return json(snapshot);
};
