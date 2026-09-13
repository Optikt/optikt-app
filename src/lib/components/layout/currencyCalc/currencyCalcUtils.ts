import { DollarSign, Euro, Pen } from '@lucide/svelte';
import type { Component } from 'svelte';
import type { ExchangeRateEntry } from '$lib/shared/exchangeRates';

export const CUSTOM_SOURCE_KEY = '__custom__';
export const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export type SavedCustomRate = {
	value: number;
	label: string;
	timestamp: number;
};

export type ConversionResult = {
	rate: ExchangeRateEntry;
	label: string;
	code: string;
	value: number;
};

export type RateStyle = { bg: string; iconClass: string; icon?: Component; svgSrc?: string };

export function currencyCode(sourceKey: string, customLabel?: string | null): string {
	if (sourceKey === CUSTOM_SOURCE_KEY)
		return customLabel ? customLabel.substring(0, 5).toUpperCase() : 'TASA';
	return sourceKey.split('_')[0].toUpperCase();
}

export function buttonLabel(sourceKey: string, customLabel?: string | null): string {
	if (sourceKey === '__custom__') return customLabel || 'Tasa';
	if (sourceKey === 'usdt') return 'USDT';
	if (sourceKey === 'usdt_compra') return 'USDT Compra';
	if (sourceKey === 'usdt_venta') return 'USDT Venta';
	return currencyCode(sourceKey);
}

export function getRateStyle(sourceKey: string): RateStyle {
	if (sourceKey === '__custom__')
		return { bg: 'bg-amber-100', iconClass: 'text-amber-600', icon: Pen };
	if (sourceKey.startsWith('eur'))
		return { bg: 'bg-indigo-100', iconClass: 'text-indigo-500', icon: Euro };
	if (sourceKey.includes('usdt') || sourceKey.includes('binance'))
		return { bg: 'bg-[#53ae94]/15', iconClass: 'text-[#53ae94]', svgSrc: '/tether.svg' };
	return { bg: 'bg-brand-blue/15', iconClass: 'text-brand-blue', icon: DollarSign };
}

export function formatValue(value: number): string {
	if (value === 0) return '—';
	if (value >= 1000)
		return value.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
	return value.toFixed(4).replace(/\.?0+$/, '') || '0';
}

export function getBsCurrencyLabel(
	baseCurrency: string,
	allRates: ExchangeRateEntry[],
	customLabel?: string | null
): string {
	if (baseCurrency === 'bs') return 'Bs';
	if (baseCurrency === CUSTOM_SOURCE_KEY) return customLabel || 'Tasa';
	const rate = allRates.find((r) => r.sourceKey === baseCurrency);
	if (!rate) return '';
	return currencyCode(rate.sourceKey);
}

export function buildCustomVirtualRate(
	savedRate: SavedCustomRate | null,
	isCustomStale: boolean
): (ExchangeRateEntry & { isCustom: boolean }) | null {
	if (!savedRate || savedRate.value <= 0) return null;
	const ageSec = Math.floor((Date.now() - savedRate.timestamp) / 1000);
	return {
		sourceKey: CUSTOM_SOURCE_KEY,
		code: savedRate.label ? savedRate.label.substring(0, 5).toUpperCase() : 'TASA',
		label: savedRate.label || 'Mi tasa',
		value: savedRate.value,
		dataAgeSeconds: ageSec,
		isStale: isCustomStale,
		lastUpdated: new Date(savedRate.timestamp).toISOString(),
		isCustom: true
	};
}

export function computeConversions(
	allRates: ExchangeRateEntry[],
	baseCurrency: string,
	amount: number,
	customLabel?: string | null
): ConversionResult[] {
	if (allRates.length === 0) return [];

	if (baseCurrency === 'bs') {
		return allRates.map((rate) => ({
			rate,
			label: rate.label,
			code: currencyCode(rate.sourceKey, customLabel),
			value: amount > 0 ? amount / rate.value : 0
		}));
	}

	const selectedRate = allRates.find((r) => r.sourceKey === baseCurrency);
	if (!selectedRate) return [];

	const bsAmount = amount * selectedRate.value;

	return allRates
		.filter((r) => r.sourceKey !== baseCurrency)
		.map((rate) => ({
			rate,
			label: rate.label,
			code: currencyCode(rate.sourceKey, customLabel),
			value: amount > 0 ? bsAmount / rate.value : 0
		}))
		.concat([
			{
				rate: selectedRate,
				label: 'Bolívares',
				code: 'Bs',
				value: amount > 0 ? bsAmount : 0
			} as ConversionResult
		])
		.sort((a, b) => (a.code === 'Bs' ? 1 : b.code === 'Bs' ? -1 : 0));
}
