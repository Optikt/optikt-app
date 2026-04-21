import { describe, it, expect } from 'vitest';
import {
	SaleStatus,
	ALL_SALE_STATUSES,
	SALE_STATUS_LABELS,
	getSaleStatusLabel,
	saleStatusColors,
	getSaleStatusBadgeColor,
	PaymentMethod,
	ALL_PAYMENT_METHODS,
	PAYMENT_METHOD_LABELS,
	getPaymentMethodLabel,
	isBsPaymentMethod,
	getExchangeRateLabel,
	DiscountType,
	ALL_DISCOUNT_TYPES,
	DISCOUNT_TYPE_LABELS,
	RefundStatus,
	ALL_REFUND_STATUSES,
	REFUND_STATUS_LABELS,
	getRefundStatusLabel
} from './salesTypes';

// ── SaleStatus ──────────────────────────────────────────────────────────

describe('SaleStatus enum', () => {
	it('has all expected values', () => {
		expect(SaleStatus.PENDING).toBe('PENDING');
		expect(SaleStatus.COMPLETED).toBe('COMPLETED');
		expect(SaleStatus.CANCELLED).toBe('CANCELLED');
	});

	it('ALL_SALE_STATUSES contains all values', () => {
		expect(ALL_SALE_STATUSES).toHaveLength(3);
		expect(ALL_SALE_STATUSES).toContain(SaleStatus.PENDING);
		expect(ALL_SALE_STATUSES).toContain(SaleStatus.COMPLETED);
		expect(ALL_SALE_STATUSES).toContain(SaleStatus.CANCELLED);
	});
});

describe('getSaleStatusLabel', () => {
	it('returns Spanish labels for known statuses', () => {
		expect(getSaleStatusLabel('PENDING')).toBe('Pendiente');
		expect(getSaleStatusLabel('COMPLETED')).toBe('Completada');
		expect(getSaleStatusLabel('CANCELLED')).toBe('Cancelada');
	});

	it('has a label for every sale status', () => {
		for (const status of ALL_SALE_STATUSES) {
			expect(SALE_STATUS_LABELS[status]).toBeDefined();
		}
	});

	it('returns raw value for unknown status', () => {
		expect(getSaleStatusLabel('REFUNDED')).toBe('REFUNDED');
	});

	it('returns raw value for empty string', () => {
		expect(getSaleStatusLabel('')).toBe('');
	});
});

describe('getSaleStatusBadgeColor', () => {
	it('returns correct badge colors', () => {
		expect(getSaleStatusBadgeColor('PENDING')).toBe('warning');
		expect(getSaleStatusBadgeColor('COMPLETED')).toBe('success');
		expect(getSaleStatusBadgeColor('CANCELLED')).toBe('error');
	});

	it('has a color for every sale status', () => {
		for (const status of ALL_SALE_STATUSES) {
			expect(saleStatusColors[status]).toBeDefined();
		}
	});

	it('returns warning (default) for unknown status', () => {
		expect(getSaleStatusBadgeColor('INVALID')).toBe('warning');
	});
});

// ── PaymentMethod ───────────────────────────────────────────────────────

describe('PaymentMethod enum', () => {
	it('has all expected values', () => {
		expect(PaymentMethod.PAGO_MOVIL_BS).toBe('PAGO_MOVIL_BS');
		expect(PaymentMethod.TRANSFERENCIA_BS).toBe('TRANSFERENCIA_BS');
		expect(PaymentMethod.PUNTO_VENTA_BS).toBe('PUNTO_VENTA_BS');
		expect(PaymentMethod.EFECTIVO_BS).toBe('EFECTIVO_BS');
		expect(PaymentMethod.EFECTIVO_USD).toBe('EFECTIVO_USD');
		expect(PaymentMethod.BINANCE_USDT).toBe('BINANCE_USDT');
	});

	it('ALL_PAYMENT_METHODS contains all values', () => {
		expect(ALL_PAYMENT_METHODS).toHaveLength(6);
		expect(ALL_PAYMENT_METHODS).toContain(PaymentMethod.PAGO_MOVIL_BS);
		expect(ALL_PAYMENT_METHODS).toContain(PaymentMethod.TRANSFERENCIA_BS);
		expect(ALL_PAYMENT_METHODS).toContain(PaymentMethod.PUNTO_VENTA_BS);
		expect(ALL_PAYMENT_METHODS).toContain(PaymentMethod.EFECTIVO_BS);
		expect(ALL_PAYMENT_METHODS).toContain(PaymentMethod.EFECTIVO_USD);
		expect(ALL_PAYMENT_METHODS).toContain(PaymentMethod.BINANCE_USDT);
	});
});

describe('getPaymentMethodLabel', () => {
	it('returns Spanish labels for known methods', () => {
		expect(getPaymentMethodLabel('PAGO_MOVIL_BS')).toBe('Pago Móvil Bs');
		expect(getPaymentMethodLabel('TRANSFERENCIA_BS')).toBe('Transferencia Bs');
		expect(getPaymentMethodLabel('PUNTO_VENTA_BS')).toBe('Punto de Venta Bs');
		expect(getPaymentMethodLabel('EFECTIVO_BS')).toBe('Efectivo Bs');
		expect(getPaymentMethodLabel('EFECTIVO_USD')).toBe('Efectivo $');
		expect(getPaymentMethodLabel('BINANCE_USDT')).toBe('Binance USDT');
	});

	it('has a label for every payment method', () => {
		for (const method of ALL_PAYMENT_METHODS) {
			expect(PAYMENT_METHOD_LABELS[method]).toBeDefined();
		}
	});

	it('returns raw value for unknown method', () => {
		expect(getPaymentMethodLabel('CRYPTO')).toBe('CRYPTO');
	});

	it('returns raw value for empty string', () => {
		expect(getPaymentMethodLabel('')).toBe('');
	});
});

describe('isBsPaymentMethod', () => {
	it('returns true for Bolivar-denominated methods', () => {
		expect(isBsPaymentMethod(PaymentMethod.PAGO_MOVIL_BS)).toBe(true);
		expect(isBsPaymentMethod(PaymentMethod.TRANSFERENCIA_BS)).toBe(true);
		expect(isBsPaymentMethod(PaymentMethod.PUNTO_VENTA_BS)).toBe(true);
		expect(isBsPaymentMethod(PaymentMethod.EFECTIVO_BS)).toBe(true);
	});

	it('returns false for non-Bolivar methods', () => {
		expect(isBsPaymentMethod(PaymentMethod.EFECTIVO_USD)).toBe(false);
		expect(isBsPaymentMethod(PaymentMethod.BINANCE_USDT)).toBe(false);
	});
});

describe('getExchangeRateLabel', () => {
	it('returns label for EFECTIVO_USD', () => {
		expect(getExchangeRateLabel(PaymentMethod.EFECTIVO_USD)).toBe('Tasa USD Cash (Bs/$)');
	});

	it('returns label for BINANCE_USDT', () => {
		expect(getExchangeRateLabel(PaymentMethod.BINANCE_USDT)).toBe('Tasa USDT (Bs/USDT)');
	});

	it('returns empty string for Bs payment methods', () => {
		expect(getExchangeRateLabel(PaymentMethod.PAGO_MOVIL_BS)).toBe('');
		expect(getExchangeRateLabel(PaymentMethod.TRANSFERENCIA_BS)).toBe('');
		expect(getExchangeRateLabel(PaymentMethod.PUNTO_VENTA_BS)).toBe('');
		expect(getExchangeRateLabel(PaymentMethod.EFECTIVO_BS)).toBe('');
	});
});

// ── DiscountType ────────────────────────────────────────────────────────

describe('DiscountType enum', () => {
	it('has all expected values', () => {
		expect(DiscountType.FIXED).toBe('FIXED');
		expect(DiscountType.PERCENTAGE).toBe('PERCENTAGE');
	});

	it('ALL_DISCOUNT_TYPES contains all values', () => {
		expect(ALL_DISCOUNT_TYPES).toHaveLength(2);
		expect(ALL_DISCOUNT_TYPES).toContain(DiscountType.FIXED);
		expect(ALL_DISCOUNT_TYPES).toContain(DiscountType.PERCENTAGE);
	});

	it('has a label for every discount type', () => {
		for (const type of ALL_DISCOUNT_TYPES) {
			expect(DISCOUNT_TYPE_LABELS[type]).toBeDefined();
		}
	});

	it('returns correct labels', () => {
		expect(DISCOUNT_TYPE_LABELS[DiscountType.FIXED]).toBe('Fijo ($)');
		expect(DISCOUNT_TYPE_LABELS[DiscountType.PERCENTAGE]).toBe('Porcentaje (%)');
	});
});

// ── RefundStatus ────────────────────────────────────────────────────────

describe('RefundStatus enum', () => {
	it('has all expected values', () => {
		expect(RefundStatus.REFUNDED).toBe('REFUNDED');
		expect(RefundStatus.RETAINED).toBe('RETAINED');
		expect(RefundStatus.NO_PAYMENT).toBe('NO_PAYMENT');
	});

	it('ALL_REFUND_STATUSES contains all values', () => {
		expect(ALL_REFUND_STATUSES).toHaveLength(3);
		expect(ALL_REFUND_STATUSES).toContain(RefundStatus.REFUNDED);
		expect(ALL_REFUND_STATUSES).toContain(RefundStatus.RETAINED);
		expect(ALL_REFUND_STATUSES).toContain(RefundStatus.NO_PAYMENT);
	});
});

describe('getRefundStatusLabel', () => {
	it('returns Spanish labels for known statuses', () => {
		expect(getRefundStatusLabel('REFUNDED')).toBe('Reembolsado');
		expect(getRefundStatusLabel('RETAINED')).toBe('Retenido');
		expect(getRefundStatusLabel('NO_PAYMENT')).toBe('Sin pagos');
	});

	it('has a label for every refund status', () => {
		for (const status of ALL_REFUND_STATUSES) {
			expect(REFUND_STATUS_LABELS[status as RefundStatus]).toBeDefined();
		}
	});

	it('returns raw value for unknown status', () => {
		expect(getRefundStatusLabel('PARTIAL')).toBe('PARTIAL');
	});

	it('returns raw value for empty string', () => {
		expect(getRefundStatusLabel('')).toBe('');
	});
});
