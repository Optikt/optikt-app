/**
 * Sales-related enums
 * Status workflow, payment methods, and discount types for the sales module
 */

import type { BadgeVariant } from '$lib/shared/badge-variants';

// ============================================================================
// SALE STATUS
// ============================================================================

export enum SaleStatus {
	PENDING = 'PENDING',
	IN_PROGRESS = 'IN_PROGRESS',
	COMPLETED = 'COMPLETED',
	CANCELLED = 'CANCELLED'
}

export const ALL_SALE_STATUSES = Object.values(SaleStatus) as SaleStatus[];

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
	[SaleStatus.PENDING]: 'Pendiente',
	[SaleStatus.IN_PROGRESS]: 'En Progreso',
	[SaleStatus.COMPLETED]: 'Completada',
	[SaleStatus.CANCELLED]: 'Cancelada'
};

export function getSaleStatusLabel(status: string): string {
	return SALE_STATUS_LABELS[status as SaleStatus] ?? status;
}

export const saleStatusColors: Record<SaleStatus, BadgeVariant> = {
	[SaleStatus.PENDING]: 'warning',
	[SaleStatus.IN_PROGRESS]: 'info',
	[SaleStatus.COMPLETED]: 'success',
	[SaleStatus.CANCELLED]: 'error'
};

export function getSaleStatusBadgeColor(status: string): BadgeVariant {
	return saleStatusColors[status as SaleStatus] ?? 'warning';
}

// ============================================================================
// PAYMENT METHOD (for individual payments)
// ============================================================================

export enum PaymentMethod {
	PAGO_MOVIL_BS = 'PAGO_MOVIL_BS',
	TRANSFERENCIA_BS = 'TRANSFERENCIA_BS',
	PUNTO_VENTA_BS = 'PUNTO_VENTA_BS',
	EFECTIVO_BS = 'EFECTIVO_BS',
	EFECTIVO_USD = 'EFECTIVO_USD',
	BINANCE_USDT = 'BINANCE_USDT'
}

export const ALL_PAYMENT_METHODS = Object.values(PaymentMethod) as PaymentMethod[];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
	[PaymentMethod.PAGO_MOVIL_BS]: 'Pago Móvil Bs',
	[PaymentMethod.TRANSFERENCIA_BS]: 'Transferencia Bs',
	[PaymentMethod.PUNTO_VENTA_BS]: 'Punto de Venta Bs',
	[PaymentMethod.EFECTIVO_BS]: 'Efectivo Bs',
	[PaymentMethod.EFECTIVO_USD]: 'Efectivo $',
	[PaymentMethod.BINANCE_USDT]: 'Binance USDT'
};

export function getPaymentMethodLabel(method: string): string {
	return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method;
}

/** Whether a payment method is denominated in Bolivares (no method-specific exchange rate needed) */
export function isBsPaymentMethod(method: PaymentMethod): boolean {
	return [
		PaymentMethod.PAGO_MOVIL_BS,
		PaymentMethod.TRANSFERENCIA_BS,
		PaymentMethod.PUNTO_VENTA_BS,
		PaymentMethod.EFECTIVO_BS
	].includes(method);
}

/** Label for the method-specific exchange rate field */
export function getExchangeRateLabel(method: PaymentMethod): string {
	switch (method) {
		case PaymentMethod.EFECTIVO_USD:
			return 'Tasa USD Cash (Bs/$)';
		case PaymentMethod.BINANCE_USDT:
			return 'Tasa USDT (Bs/USDT)';
		default:
			return '';
	}
}

// ============================================================================
// DISCOUNT TYPE
// ============================================================================

export enum DiscountType {
	FIXED = 'FIXED',
	PERCENTAGE = 'PERCENTAGE'
}

export const ALL_DISCOUNT_TYPES = Object.values(DiscountType) as DiscountType[];

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
	[DiscountType.FIXED]: 'Fijo ($)',
	[DiscountType.PERCENTAGE]: 'Porcentaje (%)'
};

// ============================================================================
// REFUND STATUS (set when a sale is cancelled)
// ============================================================================

export enum RefundStatus {
	REFUNDED = 'REFUNDED',
	RETAINED = 'RETAINED',
	NO_PAYMENT = 'NO_PAYMENT'
}

export const ALL_REFUND_STATUSES = Object.values(RefundStatus) as [string, ...string[]];

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
	[RefundStatus.REFUNDED]: 'Reembolsado',
	[RefundStatus.RETAINED]: 'Retenido',
	[RefundStatus.NO_PAYMENT]: 'Sin pagos'
};

export function getRefundStatusLabel(status: string): string {
	return REFUND_STATUS_LABELS[status as RefundStatus] ?? status;
}
