/**
 * Exchange Rates validation schemas
 * Valibot schemas for validation in remote functions
 */
import * as v from 'valibot';
import { ALL_CURRENCY_CODES } from '$lib/shared/enums';
import { CoercedNumber } from './common';

export const ListCurrenciesSchema = v.object({
	activeOnly: v.optional(v.boolean(), true)
});

export const UpsertExchangeRateSchema = v.object({
	currencyCode: v.picklist(ALL_CURRENCY_CODES, 'Moneda requerida'),
	rateToVes: v.pipe(CoercedNumber, v.minValue(0.01, 'La tasa debe ser mayor a 0')),
	effectiveDate: v.pipe(v.string(), v.minLength(1, 'Fecha requerida')),
	source: v.optional(v.string(), 'manual'),
	notes: v.optional(v.string())
});

export const BatchUpsertRatesSchema = v.object({
	rates: v.array(
		v.object({
			currencyCode: v.picklist(ALL_CURRENCY_CODES, 'Moneda requerida'),
			rateToVes: v.pipe(CoercedNumber, v.minValue(0.01, 'La tasa debe ser mayor a 0'))
		})
	),
	effectiveDate: v.pipe(v.string(), v.minLength(1, 'Fecha requerida')),
	source: v.optional(v.string(), 'manual')
});

export const GetRatesForDateSchema = v.object({
	date: v.pipe(v.string(), v.minLength(1, 'Fecha requerida'))
});

export const ExchangeRateIdSchema = v.object({
	id: v.pipe(v.string(), v.uuid())
});
