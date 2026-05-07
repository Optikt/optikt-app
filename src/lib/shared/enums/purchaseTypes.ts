/**
 * Purchase order enums
 * Status workflow and item types for the purchase/inventory module
 */

import type { BadgeVariant } from '$lib/shared/badge-variants';

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
	[PurchaseOrderUiState.DRAFT_READY]: 'Listo para revisar',
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
	[PurchaseDocumentType.DELIVERY_NOTE]: 'Nota de Entrega'
};

export function getPurchaseDocumentTypeLabel(type: string): string {
	return PURCHASE_DOCUMENT_TYPE_LABELS[type as PurchaseDocumentType] ?? type;
}
