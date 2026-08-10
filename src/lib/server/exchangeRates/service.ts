import { env } from '$env/dynamic/private';
import { fromISO, nowISO } from '$lib/dates';
import type {
	ExchangeRateApiResponse,
	ExchangeRateEntry,
	ExchangeRatesSnapshot
} from '$lib/shared/exchangeRates';
import { fetchExchangeRatesFromApi, getExchangeRatesApiUrl } from './client';
import { logger } from '$lib/utils/logger';

type RefreshSource = 'manual' | 'poller' | 'startup' | 'lazy';

type ExchangeRatesCache = {
	rates: ExchangeRateEntry[];
	lastFetchedAt: string | null;
	lastError: string | null;
	refreshPromise: Promise<ExchangeRatesSnapshot> | null;
};

const cache: ExchangeRatesCache = {
	rates: [],
	lastFetchedAt: null,
	lastError: null,
	refreshPromise: null
};

const KNOWN_RATE_KEYS: Record<string, { code: string; label: string }> = {
	usd_bcv: { code: 'USD', label: 'USD (BCV)' },
	eur_bcv: { code: 'EUR', label: 'EUR (BCV)' },
	usdt: { code: 'USDT', label: 'USDT (Promedio)' },
	usdt_compra: { code: 'USDT', label: 'USDT (Compra)' },
	usdt_venta: { code: 'USDT', label: 'USDT (Venta)' }
};

function roundExchangeRate(value: number): number {
	return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getNumberEnv(name: keyof typeof env, fallback: number): number {
	const rawValue = env[name]?.trim();
	if (!rawValue) {
		return fallback;
	}

	const parsed = Number(rawValue);
	return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getExchangeRatesPollIntervalMs(): number {
	return getNumberEnv('EXCHANGE_RATES_POLL_INTERVAL_MS', 5 * 60 * 1000);
}

export function getExchangeRatesStaleThresholdMs(): number {
	return getNumberEnv('EXCHANGE_RATES_STALE_THRESHOLD_MS', 30 * 60 * 1000);
}

function getExchangeRatesStaleNotificationWindowMs(): number {
	return getExchangeRatesStaleThresholdMs();
}

export function isExchangeRatesConfigured(): boolean {
	return Boolean(getExchangeRatesApiUrl());
}

function humanizeRateKey(apiKey: string): { code: string; label: string } {
	const known = KNOWN_RATE_KEYS[apiKey];
	if (known) {
		return known;
	}

	const snakeCaseWords = apiKey.includes('_')
		? apiKey.split('_').filter(Boolean)
		: apiKey
				.replace(/([a-z])([A-Z])/g, '$1 $2')
				.trim()
				.split(/\s+/);
	const [rawCode, ...rest] = snakeCaseWords;
	const code = rawCode ? rawCode.toUpperCase() : apiKey.toUpperCase();
	const detail = rest
		.map((part) =>
			part.toUpperCase() === 'BCV' ? 'BCV' : `${part.charAt(0).toUpperCase()}${part.slice(1)}`
		)
		.join(' ')
		.trim();
	const label = detail ? `${code} (${detail})` : code;

	return {
		code,
		label
	};
}

function mapApiRates(response: ExchangeRateApiResponse): ExchangeRateEntry[] {
	return Object.entries(response)
		.map(([sourceKey, value]) => {
			const normalized = humanizeRateKey(sourceKey);

			return {
				sourceKey,
				code: normalized.code,
				label: normalized.label,
				value: roundExchangeRate(value.value),
				dataAgeSeconds: value.data_age_seconds,
				isStale: value.is_stale,
				lastUpdated: value.last_updated
			};
		})
		.sort((left, right) => left.label.localeCompare(right.label, 'es'));
}

export function getExchangeRatesSnapshot(): ExchangeRatesSnapshot {
	const configured = isExchangeRatesConfigured();
	const staleThresholdMs = getExchangeRatesStaleThresholdMs();
	const lastFetchedAt = cache.lastFetchedAt;
	const providerHasStaleRates = cache.rates.some((rate) => rate.isStale);
	const isStale =
		configured &&
		(providerHasStaleRates ||
			!lastFetchedAt ||
			Date.now() - fromISO(lastFetchedAt).getTime() >= staleThresholdMs);

	return {
		rates: cache.rates,
		configured,
		isStale,
		lastFetchedAt,
		lastError: configured ? cache.lastError : 'API de tasas no configurada',
		staleThresholdMs,
		pollIntervalMs: getExchangeRatesPollIntervalMs(),
		staleNotificationWindowMs: getExchangeRatesStaleNotificationWindowMs()
	};
}

export function getCachedExchangeRateValue(code: string): number | null {
	return cache.rates.find((rate) => rate.code === code)?.value ?? null;
}

export async function getExchangeRateValue(code: string): Promise<number | null> {
	const cached = getCachedExchangeRateValue(code);
	if (cached !== null) {
		return cached;
	}

	if (!isExchangeRatesConfigured()) {
		return null;
	}

	const snapshot = await refreshExchangeRates({ source: 'lazy' });
	return snapshot.rates.find((rate) => rate.code === code)?.value ?? null;
}

export async function refreshExchangeRates(options?: {
	force?: boolean;
	source?: RefreshSource;
}): Promise<ExchangeRatesSnapshot> {
	if (!isExchangeRatesConfigured()) {
		cache.lastError = 'API de tasas no configurada';
		return getExchangeRatesSnapshot();
	}

	if (cache.refreshPromise && !options?.force) {
		return cache.refreshPromise;
	}

	cache.refreshPromise = (async () => {
		try {
			const apiRates = await fetchExchangeRatesFromApi();
			cache.rates = mapApiRates(apiRates);
			cache.lastFetchedAt = nowISO();
			cache.lastError = null;
		} catch (error) {
			logger.error('Error obteniendo tasas de cambio de la API', error);
			cache.lastError = 'No se pudo conectar con el proveedor de tasas';
		} finally {
			cache.refreshPromise = null;
		}

		return getExchangeRatesSnapshot();
	})();

	return cache.refreshPromise;
}
