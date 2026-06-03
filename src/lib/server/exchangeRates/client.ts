import { env } from '$env/dynamic/private';
import { z } from 'zod';
import type { ExchangeRateApiResponse } from '$lib/shared/exchangeRates';

const ExchangeRateApiFieldSchema = z.object({
	data_age_seconds: z.number().nonnegative(),
	is_stale: z.boolean(),
	last_updated: z.iso.datetime({ offset: true }),
	value: z.number()
});

const ExchangeRateApiResponseSchema = z.record(z.string(), ExchangeRateApiFieldSchema);

export function getExchangeRatesApiUrl(): string | null {
	const apiUrl = env.EXCHANGE_RATES_API_URL?.trim();
	return apiUrl ? apiUrl : null;
}

export function getExchangeRatesApiKey(): string | null {
	const apiKey = env.EXCHANGE_RATES_API_KEY?.trim();
	return apiKey ? apiKey : null;
}

export async function fetchExchangeRatesFromApi(): Promise<ExchangeRateApiResponse> {
	const apiUrl = getExchangeRatesApiUrl();
	if (!apiUrl) {
		throw new Error('API de tasas no configurada');
	}

	const apiKey = getExchangeRatesApiKey();
	const response = await fetch(`${apiUrl}/rates`, {
		headers: apiKey
			? {
					Authorization: `Bearer ${apiKey}`
				}
			: undefined
	});

	if (!response.ok) {
		throw new Error(`No se pudieron obtener las tasas (${response.status})`);
	}

	const json = await response.json();
	return ExchangeRateApiResponseSchema.parse(json);
}
