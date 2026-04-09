/**
 * Exchange Rates validation schemas
 * Zod schemas for validation in remote functions
 */
import { z } from 'zod';
import { ALL_CURRENCY_CODES } from '$lib/shared/enums';
import { CoercedNumber, EntityIdSchema } from './common';

export const ExchangeRateIdSchema = EntityIdSchema();

export const ListCurrenciesSchema = z.object({
	activeOnly: z.boolean().default(true)
});

export const UpsertExchangeRateSchema = z.object({
	currencyCode: z.enum(ALL_CURRENCY_CODES, 'Moneda requerida'),
	rateToVes: CoercedNumber.min(0.01, 'La tasa debe ser mayor a 0'),
	effectiveDate: z.iso.date('Fecha requerida (YYYY-MM-DD)'),
	source: z.string().default('manual'),
	notes: z.string().optional()
});

export const BatchUpsertRatesSchema = z.object({
	rates: z.array(
		z.object({
			currencyCode: z.enum(ALL_CURRENCY_CODES, 'Moneda requerida'),
			rateToVes: CoercedNumber.min(0.01, 'La tasa debe ser mayor a 0')
		})
	),
	effectiveDate: z.iso.date('Fecha requerida (YYYY-MM-DD)'),
	source: z.string().default('manual')
});

export const GetRatesForDateSchema = z.object({
	date: z.iso.date('Fecha requerida (YYYY-MM-DD)')
});
