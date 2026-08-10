import { command, query } from '$app/server';
import { EmptySchema } from '$lib/schemas/common';
import { publishExchangeRatesTransition } from '$lib/server/exchangeRates/health';
import { getExchangeRatesSnapshot, refreshExchangeRates } from '$lib/server/exchangeRates/service';
import { requireAuth } from '$lib/server/guards';
import type { ExchangeRateEntry, ExchangeRatesSnapshot } from '$lib/shared/exchangeRates';

export type LatestExchangeRate = {
	id: string;
	rateToVes: number;
	effectiveDate: string;
	source: string;
	notes: string | null;
	createdAt: string;
	currency: {
		code: string;
		name: string;
		symbol: string;
	};
};

function resolveRateSymbol(code: string): string {
	if (code === 'EUR') {
		return 'EUR';
	}

	if (code === 'VES') {
		return 'Bs.';
	}

	return 'USD';
}

function toLatestRates(snapshot: ExchangeRatesSnapshot): LatestExchangeRate[] {
	return snapshot.rates.map((rate: ExchangeRateEntry) => ({
		id: rate.sourceKey,
		rateToVes: rate.value,
		effectiveDate: rate.lastUpdated,
		source: 'api',
		notes: null,
		createdAt: snapshot.lastFetchedAt ?? rate.lastUpdated,
		currency: {
			code: rate.code,
			name: rate.label,
			symbol: resolveRateSymbol(rate.code)
		}
	}));
}

async function ensureExchangeRatesSnapshot(): Promise<ExchangeRatesSnapshot> {
	const snapshot = getExchangeRatesSnapshot();
	if (snapshot.configured && snapshot.rates.length === 0 && !snapshot.lastFetchedAt) {
		const nextSnapshot = await refreshExchangeRates({ source: 'lazy' });
		await publishExchangeRatesTransition(nextSnapshot);
		return nextSnapshot;
	}

	return snapshot;
}

export const fetchExchangeRates = query(async (): Promise<ExchangeRatesSnapshot> => {
	requireAuth();
	return ensureExchangeRatesSnapshot();
});

export const fetchLatestRates = query(async (): Promise<LatestExchangeRate[]> => {
	requireAuth();
	return toLatestRates(await ensureExchangeRatesSnapshot());
});

export const refreshExchangeRatesCommand = command(
	EmptySchema,
	async (): Promise<ExchangeRatesSnapshot> => {
		requireAuth();
		const snapshot = await refreshExchangeRates({ force: true, source: 'manual' });
		if (snapshot.lastError) {
			throw new Error(snapshot.lastError);
		}
		await publishExchangeRatesTransition(snapshot);
		return snapshot;
	}
);
