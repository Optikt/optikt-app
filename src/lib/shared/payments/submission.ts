import type { PaymentMethod } from '../enums/paymentMethods';
import type { CurrencyCode } from '../enums/currencyTypes';

/** Dominio que recibe el pago. */
export type PaymentDomain = 'sale' | 'purchase';

/** Contrato de entrada para registrar un pago en cualquier dominio. */
export interface PaymentSubmissionInput {
	domain: PaymentDomain;
	amount: number;
	method: PaymentMethod;
	currency: CurrencyCode;
	rate?: number | null;
	rateType?: string | null;
	reference?: string | null;
	notes?: string | null;
	metadata?: Record<string, unknown>;
}

/** Resultado de registrar un pago. */
export interface PaymentSubmissionResult {
	success: boolean;
	paymentId?: string;
	balanceAfter?: number;
	error?: string;
}
