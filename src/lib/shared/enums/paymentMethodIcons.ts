import { Smartphone, Building2, CreditCard, WalletCards, BadgeDollarSign } from '@lucide/svelte';
import type { Component } from 'svelte';
import { PaymentMethod } from './paymentMethods';

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
