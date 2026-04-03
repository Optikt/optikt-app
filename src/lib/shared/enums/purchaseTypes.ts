/**
 * Purchase order enums
 * Status workflow and item types for the purchase/inventory module
 */

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

export const purchaseOrderStatusColors: Record<PurchaseOrderStatus, 'yellow' | 'green' | 'red'> = {
	[PurchaseOrderStatus.DRAFT]: 'yellow',
	[PurchaseOrderStatus.CONFIRMED]: 'green',
	[PurchaseOrderStatus.CANCELLED]: 'red'
};

export type PurchaseOrderStatusColor = (typeof purchaseOrderStatusColors)[PurchaseOrderStatus];

export function getPurchaseOrderStatusBadgeColor(status: string): PurchaseOrderStatusColor {
	return purchaseOrderStatusColors[status as PurchaseOrderStatus] ?? 'yellow';
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
