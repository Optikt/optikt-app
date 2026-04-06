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

export const ALL_PURCHASE_ORDER_STATUSES = Object.values(
	PurchaseOrderStatus
) as PurchaseOrderStatus[];

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
	[PurchaseOrderStatus.DRAFT]: 'Borrador',
	[PurchaseOrderStatus.CONFIRMED]: 'Confirmada',
	[PurchaseOrderStatus.CANCELLED]: 'Cancelada'
};

export function getPurchaseOrderStatusLabel(status: string): string {
	return PURCHASE_ORDER_STATUS_LABELS[status as PurchaseOrderStatus] ?? status;
}

export const purchaseOrderStatusColors: Record<PurchaseOrderStatus, BadgeVariant> = {
	[PurchaseOrderStatus.DRAFT]: 'warning',
	[PurchaseOrderStatus.CONFIRMED]: 'success',
	[PurchaseOrderStatus.CANCELLED]: 'error'
};

export function getPurchaseOrderStatusBadgeColor(status: string): BadgeVariant {
	return purchaseOrderStatusColors[status as PurchaseOrderStatus] ?? 'warning';
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
