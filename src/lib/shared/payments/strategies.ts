import { CurrencyCode } from '../enums/currencyTypes';
import {
	PAYMENT_METHOD_CURRENCY,
	PAYMENT_METHOD_LABELS,
	PAYMENT_RAILS_BY_CURRENCY,
	PaymentMethod,
	SALES_RAILS_BY_CURRENCY,
	rateTypeForRail,
	requiresPaymentMethodSpecificRate
} from '../enums/paymentMethods';

/** Configuración del campo referencia por método de pago. */
export interface ReferenceConfig {
	label: string;
	required: boolean;
	placeholder: string;
	helper: string;
	fallbackValue?: string;
}

/** Estrategia consolidada por método de pago. */
export interface PaymentMethodStrategy {
	method: PaymentMethod | null;
	label: string;
	currency: CurrencyCode;
	rateType: string | null;
	referenceConfig: ReferenceConfig;
	nativeLabel: string;
	nativePrefix: string;
	requiresSpecificRate: boolean;
	railsPerCurrency: { purchase: string[]; sales: string[] };
}

function railsIn(map: Record<string, PaymentMethod[]>, method: PaymentMethod): string[] {
	return Object.keys(map).filter((key) => map[key].includes(method));
}

export const PAYMENT_METHOD_STRATEGIES: Record<PaymentMethod, PaymentMethodStrategy> = {
	[PaymentMethod.PAGO_MOVIL_BS]: {
		method: PaymentMethod.PAGO_MOVIL_BS,
		label: PAYMENT_METHOD_LABELS[PaymentMethod.PAGO_MOVIL_BS],
		currency: PAYMENT_METHOD_CURRENCY[PaymentMethod.PAGO_MOVIL_BS],
		rateType: rateTypeForRail(PaymentMethod.PAGO_MOVIL_BS),
		referenceConfig: {
			label: 'Número de confirmación',
			required: true,
			placeholder: 'Secuencia o referencia del pago móvil',
			helper: 'Obligatorio.'
		},
		nativeLabel: 'Monto (Bs)',
		nativePrefix: 'Bs',
		requiresSpecificRate: requiresPaymentMethodSpecificRate(PaymentMethod.PAGO_MOVIL_BS),
		railsPerCurrency: {
			purchase: railsIn(PAYMENT_RAILS_BY_CURRENCY, PaymentMethod.PAGO_MOVIL_BS),
			sales: railsIn(SALES_RAILS_BY_CURRENCY, PaymentMethod.PAGO_MOVIL_BS)
		}
	},
	[PaymentMethod.TRANSFERENCIA_BS]: {
		method: PaymentMethod.TRANSFERENCIA_BS,
		label: PAYMENT_METHOD_LABELS[PaymentMethod.TRANSFERENCIA_BS],
		currency: PAYMENT_METHOD_CURRENCY[PaymentMethod.TRANSFERENCIA_BS],
		rateType: rateTypeForRail(PaymentMethod.TRANSFERENCIA_BS),
		referenceConfig: {
			label: 'Número de transacción',
			required: true,
			placeholder: 'Referencia bancaria',
			helper: 'Obligatorio.'
		},
		nativeLabel: 'Monto (Bs)',
		nativePrefix: 'Bs',
		requiresSpecificRate: requiresPaymentMethodSpecificRate(PaymentMethod.TRANSFERENCIA_BS),
		railsPerCurrency: {
			purchase: railsIn(PAYMENT_RAILS_BY_CURRENCY, PaymentMethod.TRANSFERENCIA_BS),
			sales: railsIn(SALES_RAILS_BY_CURRENCY, PaymentMethod.TRANSFERENCIA_BS)
		}
	},
	[PaymentMethod.PUNTO_VENTA_BS]: {
		method: PaymentMethod.PUNTO_VENTA_BS,
		label: PAYMENT_METHOD_LABELS[PaymentMethod.PUNTO_VENTA_BS],
		currency: PAYMENT_METHOD_CURRENCY[PaymentMethod.PUNTO_VENTA_BS],
		rateType: rateTypeForRail(PaymentMethod.PUNTO_VENTA_BS),
		referenceConfig: {
			label: 'Número de lote / batch',
			required: false,
			placeholder: 'Opcional',
			helper: 'Si no aplica, se guardará --',
			fallbackValue: '--'
		},
		nativeLabel: 'Monto (Bs)',
		nativePrefix: 'Bs',
		requiresSpecificRate: requiresPaymentMethodSpecificRate(PaymentMethod.PUNTO_VENTA_BS),
		railsPerCurrency: {
			purchase: railsIn(PAYMENT_RAILS_BY_CURRENCY, PaymentMethod.PUNTO_VENTA_BS),
			sales: railsIn(SALES_RAILS_BY_CURRENCY, PaymentMethod.PUNTO_VENTA_BS)
		}
	},
	[PaymentMethod.EFECTIVO_BS]: {
		method: PaymentMethod.EFECTIVO_BS,
		label: PAYMENT_METHOD_LABELS[PaymentMethod.EFECTIVO_BS],
		currency: PAYMENT_METHOD_CURRENCY[PaymentMethod.EFECTIVO_BS],
		rateType: rateTypeForRail(PaymentMethod.EFECTIVO_BS),
		referenceConfig: {
			label: 'Referencia',
			required: false,
			placeholder: '--',
			helper: 'Opcional.'
		},
		nativeLabel: 'Monto (Bs)',
		nativePrefix: 'Bs',
		requiresSpecificRate: requiresPaymentMethodSpecificRate(PaymentMethod.EFECTIVO_BS),
		railsPerCurrency: {
			purchase: railsIn(PAYMENT_RAILS_BY_CURRENCY, PaymentMethod.EFECTIVO_BS),
			sales: railsIn(SALES_RAILS_BY_CURRENCY, PaymentMethod.EFECTIVO_BS)
		}
	},
	[PaymentMethod.EFECTIVO_USD]: {
		method: PaymentMethod.EFECTIVO_USD,
		label: PAYMENT_METHOD_LABELS[PaymentMethod.EFECTIVO_USD],
		currency: PAYMENT_METHOD_CURRENCY[PaymentMethod.EFECTIVO_USD],
		rateType: rateTypeForRail(PaymentMethod.EFECTIVO_USD),
		referenceConfig: {
			label: 'Referencia',
			required: false,
			placeholder: '--',
			helper: 'Opcional.'
		},
		nativeLabel: 'Monto (Efectivo $)',
		nativePrefix: '$',
		requiresSpecificRate: requiresPaymentMethodSpecificRate(PaymentMethod.EFECTIVO_USD),
		railsPerCurrency: {
			purchase: railsIn(PAYMENT_RAILS_BY_CURRENCY, PaymentMethod.EFECTIVO_USD),
			sales: railsIn(SALES_RAILS_BY_CURRENCY, PaymentMethod.EFECTIVO_USD)
		}
	},
	[PaymentMethod.EFECTIVO_EUR]: {
		method: PaymentMethod.EFECTIVO_EUR,
		label: PAYMENT_METHOD_LABELS[PaymentMethod.EFECTIVO_EUR],
		currency: PAYMENT_METHOD_CURRENCY[PaymentMethod.EFECTIVO_EUR],
		rateType: rateTypeForRail(PaymentMethod.EFECTIVO_EUR),
		referenceConfig: {
			label: 'Referencia',
			required: false,
			placeholder: '--',
			helper: 'Opcional.'
		},
		nativeLabel: 'Monto (Efectivo €)',
		nativePrefix: '€',
		requiresSpecificRate: requiresPaymentMethodSpecificRate(PaymentMethod.EFECTIVO_EUR),
		railsPerCurrency: {
			purchase: railsIn(PAYMENT_RAILS_BY_CURRENCY, PaymentMethod.EFECTIVO_EUR),
			sales: railsIn(SALES_RAILS_BY_CURRENCY, PaymentMethod.EFECTIVO_EUR)
		}
	},
	[PaymentMethod.BINANCE_USDT]: {
		method: PaymentMethod.BINANCE_USDT,
		label: PAYMENT_METHOD_LABELS[PaymentMethod.BINANCE_USDT],
		currency: PAYMENT_METHOD_CURRENCY[PaymentMethod.BINANCE_USDT],
		rateType: rateTypeForRail(PaymentMethod.BINANCE_USDT),
		referenceConfig: {
			label: 'ID de transacción',
			required: true,
			placeholder: 'ID o confirmación Binance',
			helper: 'Obligatorio.'
		},
		nativeLabel: 'Monto (USDT)',
		nativePrefix: 'USDT',
		requiresSpecificRate: requiresPaymentMethodSpecificRate(PaymentMethod.BINANCE_USDT),
		railsPerCurrency: {
			purchase: railsIn(PAYMENT_RAILS_BY_CURRENCY, PaymentMethod.BINANCE_USDT),
			sales: railsIn(SALES_RAILS_BY_CURRENCY, PaymentMethod.BINANCE_USDT)
		}
	},
	[PaymentMethod.PAYPAL]: {
		method: PaymentMethod.PAYPAL,
		label: PAYMENT_METHOD_LABELS[PaymentMethod.PAYPAL],
		currency: PAYMENT_METHOD_CURRENCY[PaymentMethod.PAYPAL],
		rateType: rateTypeForRail(PaymentMethod.PAYPAL),
		referenceConfig: {
			label: 'Referencia',
			required: false,
			placeholder: '--',
			helper: 'Opcional.'
		},
		nativeLabel: 'Monto (PayPal $)',
		nativePrefix: '$',
		requiresSpecificRate: requiresPaymentMethodSpecificRate(PaymentMethod.PAYPAL),
		railsPerCurrency: {
			purchase: railsIn(PAYMENT_RAILS_BY_CURRENCY, PaymentMethod.PAYPAL),
			sales: railsIn(SALES_RAILS_BY_CURRENCY, PaymentMethod.PAYPAL)
		}
	},
	[PaymentMethod.OTRO]: {
		method: PaymentMethod.OTRO,
		label: PAYMENT_METHOD_LABELS[PaymentMethod.OTRO],
		currency: PAYMENT_METHOD_CURRENCY[PaymentMethod.OTRO],
		rateType: rateTypeForRail(PaymentMethod.OTRO),
		referenceConfig: {
			label: 'Referencia',
			required: false,
			placeholder: '',
			helper: ''
		},
		nativeLabel: 'Monto (Bs)',
		nativePrefix: 'Bs',
		requiresSpecificRate: requiresPaymentMethodSpecificRate(PaymentMethod.OTRO),
		railsPerCurrency: {
			purchase: railsIn(PAYMENT_RAILS_BY_CURRENCY, PaymentMethod.OTRO),
			sales: railsIn(SALES_RAILS_BY_CURRENCY, PaymentMethod.OTRO)
		}
	}
};

export const DEFAULT_PAYMENT_STRATEGY: PaymentMethodStrategy = {
	method: null,
	label: 'Referencia',
	currency: CurrencyCode.OTHER,
	rateType: null,
	referenceConfig: {
		label: 'Referencia',
		required: false,
		placeholder: '',
		helper: ''
	},
	nativeLabel: 'Monto (Bs)',
	nativePrefix: 'Bs',
	requiresSpecificRate: false,
	railsPerCurrency: { purchase: [], sales: [] }
};

export function getPaymentMethodStrategy(
	method: PaymentMethod | null | undefined
): PaymentMethodStrategy {
	if (!method) return DEFAULT_PAYMENT_STRATEGY;
	return PAYMENT_METHOD_STRATEGIES[method] ?? DEFAULT_PAYMENT_STRATEGY;
}
