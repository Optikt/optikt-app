import { Smartphone, Building2, CreditCard, WalletCards, BadgeDollarSign } from '@lucide/svelte';
import type { Component } from 'svelte';
import { CurrencyCode } from './currencyTypes';

// ============================================================================
// PAYMENT METHODS (shared across sales and purchases)
// ============================================================================

export enum PaymentMethod {
	PAGO_MOVIL_BS = 'PAGO_MOVIL_BS',
	TRANSFERENCIA_BS = 'TRANSFERENCIA_BS',
	PUNTO_VENTA_BS = 'PUNTO_VENTA_BS',
	EFECTIVO_BS = 'EFECTIVO_BS',
	EFECTIVO_USD = 'EFECTIVO_USD',
	EFECTIVO_EUR = 'EFECTIVO_EUR',
	BINANCE_USDT = 'BINANCE_USDT',
	PAYPAL = 'PAYPAL',
	OTRO = 'OTRO'
}

export const ALL_PAYMENT_METHODS = Object.values(PaymentMethod) as PaymentMethod[];

export const BOLIVAR_PAYMENT_METHODS: PaymentMethod[] = [
	PaymentMethod.PAGO_MOVIL_BS,
	PaymentMethod.TRANSFERENCIA_BS,
	PaymentMethod.PUNTO_VENTA_BS,
	PaymentMethod.EFECTIVO_BS
];

export const FOREIGN_PAYMENT_METHODS: PaymentMethod[] = [
	PaymentMethod.EFECTIVO_USD,
	PaymentMethod.EFECTIVO_EUR,
	PaymentMethod.BINANCE_USDT,
	PaymentMethod.PAYPAL,
	PaymentMethod.OTRO
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	[PaymentMethod.PAGO_MOVIL_BS]: 'Pago Móvil Bs',
	[PaymentMethod.TRANSFERENCIA_BS]: 'Transferencia Bs',
	[PaymentMethod.PUNTO_VENTA_BS]: 'Punto de Venta Bs',
	[PaymentMethod.EFECTIVO_BS]: 'Efectivo Bs',
	[PaymentMethod.EFECTIVO_USD]: 'Efectivo $',
	[PaymentMethod.EFECTIVO_EUR]: 'Efectivo €',
	[PaymentMethod.BINANCE_USDT]: 'Binance USDT',
	[PaymentMethod.PAYPAL]: 'PayPal',
	[PaymentMethod.OTRO]: 'Otro'
};

export function getPaymentMethodLabel(method: string): string {
	return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
}

/** Whether a payment method is denominated in Bolivares (no method-specific exchange rate needed). */
export function isBsPaymentMethod(method: PaymentMethod): boolean {
	return BOLIVAR_PAYMENT_METHODS.includes(method);
}

/** Currency persisted on the payment row for each method. */
export const PAYMENT_METHOD_CURRENCY: Record<PaymentMethod, CurrencyCode> = {
	[PaymentMethod.PAGO_MOVIL_BS]: CurrencyCode.VES,
	[PaymentMethod.TRANSFERENCIA_BS]: CurrencyCode.VES,
	[PaymentMethod.PUNTO_VENTA_BS]: CurrencyCode.VES,
	[PaymentMethod.EFECTIVO_BS]: CurrencyCode.VES,
	[PaymentMethod.EFECTIVO_USD]: CurrencyCode.USD_BCV,
	[PaymentMethod.EFECTIVO_EUR]: CurrencyCode.EUR_BCV,
	[PaymentMethod.BINANCE_USDT]: CurrencyCode.USDT,
	[PaymentMethod.PAYPAL]: CurrencyCode.USD_PAYPAL,
	[PaymentMethod.OTRO]: CurrencyCode.OTHER
};

export function getPaymentMethodCurrency(method: PaymentMethod): CurrencyCode {
	return PAYMENT_METHOD_CURRENCY[method] ?? CurrencyCode.OTHER;
}

/** Whether the method requires a method-specific exchange rate (non-Bs, non-USD-cash). */
export function requiresPaymentMethodSpecificRate(method: PaymentMethod): boolean {
	return (
		method === PaymentMethod.EFECTIVO_EUR ||
		method === PaymentMethod.BINANCE_USDT ||
		method === PaymentMethod.PAYPAL ||
		method === PaymentMethod.OTRO
	);
}

/** Lucide icon per payment method, shared across sales and purchases. */
export const PAYMENT_METHOD_ICONS: Record<string, Component<{ class?: string }>> = {
	[PaymentMethod.PAGO_MOVIL_BS]: Smartphone,
	[PaymentMethod.TRANSFERENCIA_BS]: Building2,
	[PaymentMethod.PUNTO_VENTA_BS]: CreditCard,
	[PaymentMethod.EFECTIVO_BS]: WalletCards,
	[PaymentMethod.EFECTIVO_USD]: WalletCards,
	[PaymentMethod.EFECTIVO_EUR]: WalletCards,
	[PaymentMethod.BINANCE_USDT]: BadgeDollarSign,
	[PaymentMethod.PAYPAL]: WalletCards,
	[PaymentMethod.OTRO]: BadgeDollarSign
};

// ============================================================================
// 2-STEP SELECTION (currency/rate → rail)
// ============================================================================

export interface PaymentCurrencyGroup {
	key: string;
	label: string;
	currencyCode: CurrencyCode;
	/** Rate label shown when this currency is selected with a Bs rail. */
	rateLabel: string;
}

/** Step 1: how the payment is referenced (rate context). */
export const PAYMENT_CURRENCY_GROUPS: PaymentCurrencyGroup[] = [
	{ key: 'VES', label: 'Bs · BCV', currencyCode: CurrencyCode.VES, rateLabel: '' },
	{ key: 'USD_BCV', label: 'USD · BCV', currencyCode: CurrencyCode.USD_BCV, rateLabel: '' },
	{
		key: 'EUR_BCV',
		label: 'EUR · BCV',
		currencyCode: CurrencyCode.EUR_BCV,
		rateLabel: 'Tasa EUR (Bs/€)'
	},
	{ key: 'USDT', label: 'USDT', currencyCode: CurrencyCode.USDT, rateLabel: 'Tasa USDT (Bs/USDT)' },
	{
		key: 'PAYPAL',
		label: 'PayPal',
		currencyCode: CurrencyCode.USD_PAYPAL,
		rateLabel: 'Tasa PayPal (Bs/$)'
	},
	{
		key: 'OTHER',
		label: 'Otro',
		currencyCode: CurrencyCode.OTHER,
		rateLabel: 'Tasa usada (Bs/unidad)'
	}
];

/** Step 2: rails available per currency. Bs rails are usable at any rate context. */
export const PAYMENT_RAILS_BY_CURRENCY: Record<string, PaymentMethod[]> = {
	VES: [
		PaymentMethod.TRANSFERENCIA_BS,
		PaymentMethod.PAGO_MOVIL_BS,
		PaymentMethod.PUNTO_VENTA_BS,
		PaymentMethod.EFECTIVO_BS
	],
	USD_BCV: [PaymentMethod.EFECTIVO_USD, ...BOLIVAR_PAYMENT_METHODS],
	EUR_BCV: [PaymentMethod.EFECTIVO_EUR, ...BOLIVAR_PAYMENT_METHODS],
	USDT: [PaymentMethod.BINANCE_USDT],
	PAYPAL: [PaymentMethod.PAYPAL, PaymentMethod.TRANSFERENCIA_BS, PaymentMethod.PAGO_MOVIL_BS],
	OTHER: [PaymentMethod.OTRO, PaymentMethod.TRANSFERENCIA_BS, PaymentMethod.EFECTIVO_BS]
};

/** The persisted paymentMethod for a currency+rail selection. */
export function resolvePaymentMethod(currencyKey: string, rail: PaymentMethod): PaymentMethod {
	return rail;
}

/** rateType value (labels the specificRate) for a currency selection, or null. */
export function rateTypeForCurrency(currencyKey: string): string | null {
	switch (currencyKey) {
		case 'EUR_BCV':
			return CurrencyCode.EUR_BCV;
		case 'USDT':
			return CurrencyCode.USDT;
		case 'PAYPAL':
			return CurrencyCode.USD_PAYPAL;
		case 'OTHER':
			return CurrencyCode.OTHER;
		default:
			return null;
	}
}

/** Rails available per currency in the SALES context (customer payments). */
export const SALES_RAILS_BY_CURRENCY: Record<string, PaymentMethod[]> = {
	VES: [...BOLIVAR_PAYMENT_METHODS],
	USD_BCV: [PaymentMethod.EFECTIVO_USD],
	EUR_BCV: [PaymentMethod.EFECTIVO_EUR],
	USDT: [PaymentMethod.BINANCE_USDT],
	PAYPAL: [PaymentMethod.PAYPAL],
	OTHER: [PaymentMethod.OTRO]
};

/** rateType value (labels the specificRate semantics) for a cash/rail selection, or null. */
export function rateTypeForRail(rail: PaymentMethod): string | null {
	switch (rail) {
		case PaymentMethod.EFECTIVO_USD:
			return 'USD_EFECTIVO';
		case PaymentMethod.EFECTIVO_EUR:
			return 'EUR_EFECTIVO';
		case PaymentMethod.BINANCE_USDT:
			return CurrencyCode.USDT;
		case PaymentMethod.PAYPAL:
			return CurrencyCode.USD_PAYPAL;
		case PaymentMethod.OTRO:
			return CurrencyCode.OTHER;
		default:
			return null;
	}
}
