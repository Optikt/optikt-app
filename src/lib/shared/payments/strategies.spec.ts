import { describe, expect, it } from 'vitest';
import { CurrencyCode } from '../enums/currencyTypes';
import { ALL_PAYMENT_METHODS, PaymentMethod } from '../enums/paymentMethods';
import {
	DEFAULT_PAYMENT_STRATEGY,
	PAYMENT_METHOD_STRATEGIES,
	getPaymentMethodStrategy,
	type PaymentMethodStrategy
} from './strategies';

interface ExpectedStrategy {
	method: PaymentMethod;
	label: string;
	currency: CurrencyCode;
	rateType: string | null;
	requiresSpecificRate: boolean;
	referenceConfig: PaymentMethodStrategy['referenceConfig'];
	nativeLabel: string;
	nativePrefix: string;
}

const EXPECTED: ExpectedStrategy[] = [
	{
		method: PaymentMethod.PAGO_MOVIL_BS,
		label: 'Pago Móvil Bs',
		currency: CurrencyCode.VES,
		rateType: null,
		requiresSpecificRate: false,
		referenceConfig: {
			label: 'Número de confirmación',
			required: true,
			placeholder: 'Secuencia o referencia del pago móvil',
			helper: 'Obligatorio.',
			fallbackValue: undefined
		},
		nativeLabel: 'Monto (Bs)',
		nativePrefix: 'Bs'
	},
	{
		method: PaymentMethod.TRANSFERENCIA_BS,
		label: 'Transferencia Bs',
		currency: CurrencyCode.VES,
		rateType: null,
		requiresSpecificRate: false,
		referenceConfig: {
			label: 'Número de transacción',
			required: true,
			placeholder: 'Referencia bancaria',
			helper: 'Obligatorio.',
			fallbackValue: undefined
		},
		nativeLabel: 'Monto (Bs)',
		nativePrefix: 'Bs'
	},
	{
		method: PaymentMethod.PUNTO_VENTA_BS,
		label: 'Punto de Venta Bs',
		currency: CurrencyCode.VES,
		rateType: null,
		requiresSpecificRate: false,
		referenceConfig: {
			label: 'Número de lote / batch',
			required: false,
			placeholder: 'Opcional',
			helper: 'Si no aplica, se guardará --',
			fallbackValue: '--'
		},
		nativeLabel: 'Monto (Bs)',
		nativePrefix: 'Bs'
	},
	{
		method: PaymentMethod.EFECTIVO_BS,
		label: 'Efectivo Bs',
		currency: CurrencyCode.VES,
		rateType: null,
		requiresSpecificRate: false,
		referenceConfig: {
			label: 'Referencia',
			required: false,
			placeholder: '--',
			helper: 'Opcional.',
			fallbackValue: undefined
		},
		nativeLabel: 'Monto (Bs)',
		nativePrefix: 'Bs'
	},
	{
		method: PaymentMethod.EFECTIVO_USD,
		label: 'Efectivo $',
		currency: CurrencyCode.USD_BCV,
		rateType: 'USD_EFECTIVO',
		requiresSpecificRate: false,
		referenceConfig: {
			label: 'Referencia',
			required: false,
			placeholder: '--',
			helper: 'Opcional.',
			fallbackValue: undefined
		},
		nativeLabel: 'Monto (Efectivo $)',
		nativePrefix: '$'
	},
	{
		method: PaymentMethod.EFECTIVO_EUR,
		label: 'Efectivo €',
		currency: CurrencyCode.EUR_BCV,
		rateType: 'EUR_EFECTIVO',
		requiresSpecificRate: true,
		referenceConfig: {
			label: 'Referencia',
			required: false,
			placeholder: '--',
			helper: 'Opcional.',
			fallbackValue: undefined
		},
		nativeLabel: 'Monto (Efectivo €)',
		nativePrefix: '€'
	},
	{
		method: PaymentMethod.BINANCE_USDT,
		label: 'Binance USDT',
		currency: CurrencyCode.USDT,
		rateType: CurrencyCode.USDT,
		requiresSpecificRate: true,
		referenceConfig: {
			label: 'ID de transacción',
			required: true,
			placeholder: 'ID o confirmación Binance',
			helper: 'Obligatorio.',
			fallbackValue: undefined
		},
		nativeLabel: 'Monto (USDT)',
		nativePrefix: 'USDT'
	},
	{
		method: PaymentMethod.PAYPAL,
		label: 'PayPal',
		currency: CurrencyCode.USD_PAYPAL,
		rateType: CurrencyCode.USD_PAYPAL,
		requiresSpecificRate: true,
		referenceConfig: {
			label: 'Referencia',
			required: false,
			placeholder: '--',
			helper: 'Opcional.',
			fallbackValue: undefined
		},
		nativeLabel: 'Monto (PayPal $)',
		nativePrefix: '$'
	},
	{
		method: PaymentMethod.OTRO,
		label: 'Otro',
		currency: CurrencyCode.OTHER,
		rateType: CurrencyCode.OTHER,
		requiresSpecificRate: true,
		referenceConfig: {
			label: 'Referencia',
			required: false,
			placeholder: '',
			helper: '',
			fallbackValue: undefined
		},
		nativeLabel: 'Monto (Bs)',
		nativePrefix: 'Bs'
	}
];

describe('PAYMENT_METHOD_STRATEGIES', () => {
	it('registry tiene exactamente las 9 keys de ALL_PAYMENT_METHODS', () => {
		expect(Object.keys(PAYMENT_METHOD_STRATEGIES).sort()).toEqual([...ALL_PAYMENT_METHODS].sort());
	});

	for (const expected of EXPECTED) {
		it(`${expected.method} expone strategy esperado`, () => {
			const strategy = getPaymentMethodStrategy(expected.method);
			expect(strategy.label).toBe(expected.label);
			expect(strategy.currency).toBe(expected.currency);
			expect(strategy.rateType).toBe(expected.rateType);
			expect(strategy.requiresSpecificRate).toBe(expected.requiresSpecificRate);
			expect(strategy.referenceConfig).toEqual(expected.referenceConfig);
			expect(strategy.nativeLabel).toBe(expected.nativeLabel);
			expect(strategy.nativePrefix).toBe(expected.nativePrefix);
		});
	}

	it('getPaymentMethodStrategy(null) retorna DEFAULT_PAYMENT_STRATEGY', () => {
		expect(getPaymentMethodStrategy(null)).toEqual(DEFAULT_PAYMENT_STRATEGY);
	});

	it('getPaymentMethodStrategy(undefined) retorna DEFAULT_PAYMENT_STRATEGY', () => {
		expect(getPaymentMethodStrategy(undefined)).toEqual(DEFAULT_PAYMENT_STRATEGY);
	});

	it('TRANSFERENCIA_BS purchase incluye VES', () => {
		expect(
			getPaymentMethodStrategy(PaymentMethod.TRANSFERENCIA_BS).railsPerCurrency.purchase
		).toContain('VES');
	});

	it('BINANCE_USDT purchase es [USDT]', () => {
		expect(getPaymentMethodStrategy(PaymentMethod.BINANCE_USDT).railsPerCurrency.purchase).toEqual([
			'USDT'
		]);
	});

	it('EFECTIVO_USD sales es [USD_BCV]', () => {
		expect(getPaymentMethodStrategy(PaymentMethod.EFECTIVO_USD).railsPerCurrency.sales).toEqual([
			'USD_BCV'
		]);
	});

	it('PAGO_MOVIL_BS sales incluye VES', () => {
		expect(getPaymentMethodStrategy(PaymentMethod.PAGO_MOVIL_BS).railsPerCurrency.sales).toContain(
			'VES'
		);
	});
});
