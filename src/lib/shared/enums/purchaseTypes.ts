/**
 * Purchase order enums
 * Status workflow and item types for the purchase/inventory module
 */

import type { BadgeVariant } from '$lib/shared/badge-variants';
import { CurrencyCode } from './currencyTypes';

// ============================================================================
// PURCHASE ORDER STATUS
// ============================================================================

export enum PurchaseOrderStatus {
	DRAFT = 'DRAFT',
	CONFIRMED = 'CONFIRMED',
	CANCELLED = 'CANCELLED'
}

export enum PurchaseOrderUiState {
	DRAFT_IN_PROGRESS = 'DRAFT_IN_PROGRESS',
	DRAFT_READY = 'DRAFT_READY',
	CONFIRMED = 'CONFIRMED',
	CANCELLED = 'CANCELLED'
}

export interface PurchaseOrderUiStateSource {
	status: string;
	isReadyForReview?: boolean | null;
}

export const ALL_PURCHASE_ORDER_STATUSES = Object.values(
	PurchaseOrderStatus
) as PurchaseOrderStatus[];

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
	[PurchaseOrderStatus.DRAFT]: 'Borrador',
	[PurchaseOrderStatus.CONFIRMED]: 'Confirmada',
	[PurchaseOrderStatus.CANCELLED]: 'Cancelada'
};

export const PURCHASE_ORDER_UI_STATE_LABELS: Record<PurchaseOrderUiState, string> = {
	[PurchaseOrderUiState.DRAFT_IN_PROGRESS]: 'En preparación',
	[PurchaseOrderUiState.DRAFT_READY]: 'En revisión',
	[PurchaseOrderUiState.CONFIRMED]: 'Confirmada',
	[PurchaseOrderUiState.CANCELLED]: 'Cancelada'
};

export function getPurchaseOrderStatusLabel(status: string): string {
	return PURCHASE_ORDER_STATUS_LABELS[status as PurchaseOrderStatus] ?? status;
}

export const purchaseOrderStatusColors: Record<PurchaseOrderStatus, BadgeVariant> = {
	[PurchaseOrderStatus.DRAFT]: 'warning',
	[PurchaseOrderStatus.CONFIRMED]: 'success',
	[PurchaseOrderStatus.CANCELLED]: 'error'
};

export const purchaseOrderUiStateColors: Record<PurchaseOrderUiState, BadgeVariant> = {
	[PurchaseOrderUiState.DRAFT_IN_PROGRESS]: 'neutral',
	[PurchaseOrderUiState.DRAFT_READY]: 'warning',
	[PurchaseOrderUiState.CONFIRMED]: 'success',
	[PurchaseOrderUiState.CANCELLED]: 'error'
};

export function getPurchaseOrderStatusBadgeColor(status: string): BadgeVariant {
	return purchaseOrderStatusColors[status as PurchaseOrderStatus] ?? 'warning';
}

export function getPurchaseOrderUiState(order: PurchaseOrderUiStateSource): PurchaseOrderUiState {
	if (order.status === PurchaseOrderStatus.DRAFT) {
		return order.isReadyForReview
			? PurchaseOrderUiState.DRAFT_READY
			: PurchaseOrderUiState.DRAFT_IN_PROGRESS;
	}

	if (order.status === PurchaseOrderStatus.CONFIRMED) return PurchaseOrderUiState.CONFIRMED;
	if (order.status === PurchaseOrderStatus.CANCELLED) return PurchaseOrderUiState.CANCELLED;

	return PurchaseOrderUiState.DRAFT_IN_PROGRESS;
}

export function getPurchaseOrderUiStateLabel(order: PurchaseOrderUiStateSource): string {
	return PURCHASE_ORDER_UI_STATE_LABELS[getPurchaseOrderUiState(order)];
}

export function getPurchaseOrderUiStateBadgeColor(order: PurchaseOrderUiStateSource): BadgeVariant {
	return purchaseOrderUiStateColors[getPurchaseOrderUiState(order)];
}

// ============================================================================
// PURCHASE ORDER ITEM TYPE
// ============================================================================

export enum PurchaseOrderItemType {
	PRODUCT = 'PRODUCT',
	LENS = 'LENS'
}

export const ALL_PURCHASE_ORDER_ITEM_TYPES = Object.values(
	PurchaseOrderItemType
) as PurchaseOrderItemType[];

export const PURCHASE_ORDER_ITEM_TYPE_LABELS: Record<PurchaseOrderItemType, string> = {
	[PurchaseOrderItemType.PRODUCT]: 'Producto',
	[PurchaseOrderItemType.LENS]: 'Lente'
};

export function getPurchaseOrderItemTypeLabel(status: string): string {
	return PURCHASE_ORDER_ITEM_TYPE_LABELS[status as PurchaseOrderItemType] ?? status;
}

// ============================================================================
// PURCHASE DOCUMENT TYPE (Factura vs Nota de Entrega)
// ============================================================================

export enum PurchaseDocumentType {
	INVOICE = 'INVOICE',
	DELIVERY_NOTE = 'DELIVERY_NOTE'
}

export const PURCHASE_DOCUMENT_TYPE_LABELS: Record<PurchaseDocumentType, string> = {
	[PurchaseDocumentType.INVOICE]: 'Factura',
	[PurchaseDocumentType.DELIVERY_NOTE]: 'Nota'
};

export function getPurchaseDocumentTypeLabel(type: string): string {
	return PURCHASE_DOCUMENT_TYPE_LABELS[type as PurchaseDocumentType] ?? type;
}

// ============================================================================
// PURCHASE PAYMENT TERMS
// ============================================================================

export enum PurchasePaymentTerms {
	CONTADO = 'CONTADO',
	CREDIT = 'CREDIT'
}

export const ALL_PURCHASE_PAYMENT_TERMS = Object.values(
	PurchasePaymentTerms
) as PurchasePaymentTerms[];

export const PURCHASE_PAYMENT_TERMS_LABELS: Record<PurchasePaymentTerms, string> = {
	[PurchasePaymentTerms.CONTADO]: 'Contado',
	[PurchasePaymentTerms.CREDIT]: 'Crédito'
};

export function getPurchasePaymentTermsLabel(type: string): string {
	return PURCHASE_PAYMENT_TERMS_LABELS[type as PurchasePaymentTerms] ?? type;
}

// ============================================================================
// PURCHASE SETTLEMENT DISCOUNT TYPE
// ============================================================================

/**
 * Settlement discount applied to the purchase order header at payment time.
 * - NONE: no discount.
 * - PERCENT: percentage off the gross subtotal (value in 0..100).
 * - AMOUNT: fixed USD amount off the gross subtotal (value >= 0).
 *
 * Lines remain at gross prices (matching the supplier's delivery note).
 * On confirmation, the discount is prorated into each lot's `unitPurchasePrice`
 * so downstream COGS, margin, and inventory valuation reflect the real cost.
 */
export enum PurchaseDiscountType {
	NONE = 'NONE',
	PERCENT = 'PERCENT',
	AMOUNT = 'AMOUNT'
}

export const ALL_PURCHASE_DISCOUNT_TYPES = Object.values(
	PurchaseDiscountType
) as PurchaseDiscountType[];

export const PURCHASE_DISCOUNT_TYPE_LABELS: Record<PurchaseDiscountType, string> = {
	[PurchaseDiscountType.NONE]: 'Sin descuento',
	[PurchaseDiscountType.PERCENT]: 'Porcentaje',
	[PurchaseDiscountType.AMOUNT]: 'Monto fijo'
};

export function getPurchaseDiscountTypeLabel(type: string): string {
	return PURCHASE_DISCOUNT_TYPE_LABELS[type as PurchaseDiscountType] ?? type;
}

// ============================================================================
// PURCHASE SOURCE CURRENCY
// ============================================================================

/**
 * The currency in which the supplier's prices are expressed on the source document.
 * - USD: prices entered in USD BCV (default, no conversion needed)
 * - VES: prices entered in Bs — divided by bcvRate to normalize to USD
 * - EUR: prices entered in EUR — multiplied by sourceRateToVes then divided by bcvRate to normalize to USD
 * - USDT / PAYPAL: modeled for the native-debt workflow and enabled in the purchase UI in phase 4A
 */
export enum PurchaseSourceCurrency {
	USD = 'USD',
	VES = 'VES',
	EUR = 'EUR',
	USDT = 'USDT',
	PAYPAL = 'PAYPAL'
}

export const ALL_PURCHASE_SOURCE_CURRENCIES = Object.values(
	PurchaseSourceCurrency
) as PurchaseSourceCurrency[];

/** Source currencies currently available in the purchase-order UI. */
export const ACTIVE_PURCHASE_SOURCE_CURRENCIES = [
	PurchaseSourceCurrency.USD,
	PurchaseSourceCurrency.VES,
	PurchaseSourceCurrency.EUR,
	PurchaseSourceCurrency.USDT,
	PurchaseSourceCurrency.PAYPAL
] as const;

export const PURCHASE_SOURCE_CURRENCY_LABELS: Record<PurchaseSourceCurrency, string> = {
	[PurchaseSourceCurrency.USD]: 'USD BCV',
	[PurchaseSourceCurrency.VES]: 'Bolívares',
	[PurchaseSourceCurrency.EUR]: 'Euro (€)',
	[PurchaseSourceCurrency.USDT]: 'USDT',
	[PurchaseSourceCurrency.PAYPAL]: 'USD PayPal'
};

export const PURCHASE_SOURCE_CURRENCY_SYMBOLS: Record<PurchaseSourceCurrency, string> = {
	[PurchaseSourceCurrency.USD]: '$',
	[PurchaseSourceCurrency.VES]: 'Bs',
	[PurchaseSourceCurrency.EUR]: '€',
	[PurchaseSourceCurrency.USDT]: 'USDT',
	[PurchaseSourceCurrency.PAYPAL]: '$'
};

export function getPurchaseSourceCurrencyLabel(currency: string): string {
	return PURCHASE_SOURCE_CURRENCY_LABELS[currency as PurchaseSourceCurrency] ?? currency;
}

export function getPurchaseSourceCurrencySymbol(currency: string): string {
	return PURCHASE_SOURCE_CURRENCY_SYMBOLS[currency as PurchaseSourceCurrency] ?? currency;
}

/** Whether this source currency requires entering an alt price (not USD). */
export function isAltSourceCurrency(currency: string): boolean {
	return currency === PurchaseSourceCurrency.VES || currency === PurchaseSourceCurrency.EUR;
}

// ============================================================================
// PURCHASE PAYMENT METHOD
// ============================================================================

/**
 * How a purchase-order payment was executed (supplier-facing payment rail).
 * Mirrors the sales `PaymentMethod` set plus OTRO for exotic currencies
 * (EUR, PayPal, or any free-form channel). The method determines the
 * `currencyCode` persisted on the payment for normalization.
 */
export enum PurchasePaymentMethod {
	PAGO_MOVIL_BS = 'PAGO_MOVIL_BS',
	TRANSFERENCIA_BS = 'TRANSFERENCIA_BS',
	PUNTO_VENTA_BS = 'PUNTO_VENTA_BS',
	EFECTIVO_BS = 'EFECTIVO_BS',
	EFECTIVO_USD = 'EFECTIVO_USD',
	BINANCE_USDT = 'BINANCE_USDT',
	OTRO = 'OTRO'
}

export const ALL_PURCHASE_PAYMENT_METHODS = Object.values(
	PurchasePaymentMethod
) as PurchasePaymentMethod[];

export const PURCHASE_PAYMENT_METHOD_LABELS: Record<PurchasePaymentMethod, string> = {
	[PurchasePaymentMethod.PAGO_MOVIL_BS]: 'Pago Móvil Bs',
	[PurchasePaymentMethod.TRANSFERENCIA_BS]: 'Transferencia Bs',
	[PurchasePaymentMethod.PUNTO_VENTA_BS]: 'Punto de Venta Bs',
	[PurchasePaymentMethod.EFECTIVO_BS]: 'Efectivo Bs',
	[PurchasePaymentMethod.EFECTIVO_USD]: 'Efectivo $',
	[PurchasePaymentMethod.BINANCE_USDT]: 'Binance USDT',
	[PurchasePaymentMethod.OTRO]: 'Otro'
};

export function getPurchasePaymentMethodLabel(method: string): string {
	return PURCHASE_PAYMENT_METHOD_LABELS[method as PurchasePaymentMethod] ?? method;
}

/** Currency persisted on the payment row for each method. */
export const PURCHASE_PAYMENT_METHOD_CURRENCY: Record<PurchasePaymentMethod, CurrencyCode> = {
	[PurchasePaymentMethod.PAGO_MOVIL_BS]: CurrencyCode.VES,
	[PurchasePaymentMethod.TRANSFERENCIA_BS]: CurrencyCode.VES,
	[PurchasePaymentMethod.PUNTO_VENTA_BS]: CurrencyCode.VES,
	[PurchasePaymentMethod.EFECTIVO_BS]: CurrencyCode.VES,
	[PurchasePaymentMethod.EFECTIVO_USD]: CurrencyCode.USD_BCV,
	[PurchasePaymentMethod.BINANCE_USDT]: CurrencyCode.USDT,
	[PurchasePaymentMethod.OTRO]: CurrencyCode.OTHER
};

export function currencyForPurchasePaymentMethod(method: PurchasePaymentMethod): CurrencyCode {
	return PURCHASE_PAYMENT_METHOD_CURRENCY[method] ?? CurrencyCode.OTHER;
}

/**
 * Whether the method requires a method-specific exchange rate to VES.
 * Bs methods normalize via the BCV rate only; USD BCV cash is the base.
 */
export function requiresPurchasePaymentMethodSpecificRate(method: PurchasePaymentMethod): boolean {
	return method === PurchasePaymentMethod.BINANCE_USDT || method === PurchasePaymentMethod.OTRO;
}

/** Label for the method-specific exchange rate field. */
export function getPurchasePaymentMethodRateLabel(method: PurchasePaymentMethod): string {
	switch (method) {
		case PurchasePaymentMethod.BINANCE_USDT:
			return 'Tasa USDT (Bs/USDT)';
		case PurchasePaymentMethod.OTRO:
			return 'Tasa usada (Bs/unidad)';
		default:
			return '';
	}
}

/** Placeholder hint for the payment reference field per method. */
export function getPurchasePaymentMethodReferenceHint(method: PurchasePaymentMethod): string {
	switch (method) {
		case PurchasePaymentMethod.PAGO_MOVIL_BS:
			return 'Banco, cédula y teléfono del emisor';
		case PurchasePaymentMethod.TRANSFERENCIA_BS:
			return 'Banco y número de referencia';
		case PurchasePaymentMethod.PUNTO_VENTA_BS:
			return 'Banco y lote / voucher';
		case PurchasePaymentMethod.BINANCE_USDT:
			return 'TXID o hash de la transacción';
		default:
			return 'Banco, recibo o referencia';
	}
}
