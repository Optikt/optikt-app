import type { ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';
import { notifyRateOutdated, notifyRatesUpdated } from '$lib/server/notifications/service';

export type ExchangeRatesTransition = 'became_stale' | 'recovered' | null;

let lastKnownRatesWereStale = false;

export function resolveExchangeRatesTransition(
	previousWasStale: boolean,
	snapshot: Pick<ExchangeRatesSnapshot, 'isStale'>
): ExchangeRatesTransition {
	if (snapshot.isStale && !previousWasStale) {
		return 'became_stale';
	}

	if (!snapshot.isStale && previousWasStale) {
		return 'recovered';
	}

	return null;
}

export function syncExchangeRatesHealthState(
	snapshot: Pick<ExchangeRatesSnapshot, 'isStale'>
) {
	lastKnownRatesWereStale = snapshot.isStale;
}

export async function publishExchangeRatesTransition(snapshot: ExchangeRatesSnapshot) {
	const transition = resolveExchangeRatesTransition(lastKnownRatesWereStale, snapshot);

	if (transition === 'became_stale') {
		await notifyRateOutdated({
			lastFetchedAt: snapshot.lastFetchedAt,
			lastError: snapshot.lastError
		});
	} else if (transition === 'recovered') {
		await notifyRatesUpdated({
			refreshedAt: snapshot.lastFetchedAt ?? new Date().toISOString(),
			updatedKeys: snapshot.rates.map((rate) => rate.sourceKey)
		});
	}

	syncExchangeRatesHealthState(snapshot);
}