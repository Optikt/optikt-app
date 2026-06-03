export type ExchangeRateApiField = {
	data_age_seconds: number;
	is_stale: boolean;
	last_updated: string;
	value: number;
};

export type ExchangeRateApiResponse = Record<string, ExchangeRateApiField>;

export type ExchangeRateEntry = {
	sourceKey: string;
	code: string;
	label: string;
	value: number;
	dataAgeSeconds: number;
	isStale: boolean;
	lastUpdated: string;
};

export type ExchangeRatesSnapshot = {
	rates: ExchangeRateEntry[];
	configured: boolean;
	isStale: boolean;
	lastFetchedAt: string | null;
	lastError: string | null;
	staleThresholdMs: number;
	pollIntervalMs: number;
	staleNotificationWindowMs: number;
};
