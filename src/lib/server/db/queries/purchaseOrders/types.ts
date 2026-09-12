/**
 * Purchase order queries — exported types.
 * Split from queries/purchaseOrders.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */
import { type AnyColumn } from 'drizzle-orm';

import { purchaseOrders, type PurchaseOrder, type PurchaseOrderItem } from '$lib/server/db/schema';

import { PurchaseOrderItemType } from '$lib/shared/enums';

import {
	type PurchaseOrderBalanceSummary,
	type PurchaseOrderDueStatus
} from '$lib/shared/purchaseOrderCredit';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PurchaseOrderWithRelations = PurchaseOrder & {
	supplier: { id: string; name: string } | null;
	createdBy: { id: string; fullName: string } | null;
	confirmedBy: { id: string; fullName: string } | null;
	balance?: PurchaseOrderBalanceSummary;
	dueStatus?: PurchaseOrderDueStatus;
};

export type PurchaseOrderItemWithProduct = PurchaseOrderItem & {
	product: { id: string; name: string; sku: string; personalCode: string | null } | null;
	lensCatalogItem: { id: string; name: string; type: string } | null;
};

export type PurchaseOrderOrderBy = 'orderNumber' | 'orderDate' | 'createdAt' | 'status';

export interface PurchaseOrderFilterOptions {
	includeDeleted?: boolean;
	search?: string;
	status?: string;
	readyForReview?: boolean;
	supplierId?: string;
	/** When true, only return orders with a pending balance (not fully paid). */
	hasPendingBalance?: boolean;
	/** When true, only return confirmed credit orders with an overdue installment and balance. */
	hasOverdueBalance?: boolean;
}

export interface PurchaseOrderListStats {
	total: number;
	confirmed: number;
	draft: number;
	draftInProgress: number;
	draftReady: number;
	monthlySpend: number;
}

export interface PurchaseOrderItemDraftInput {
	id?: string;
	itemType: PurchaseOrderItemType;
	productId: string | null;
	lensCatalogItemId: string | null;
	quantity: number;
	unitPurchasePrice: number;
	unitPurchasePriceAlt?: number | null;
	unitSalePrice: number;
	appliesIva: boolean;
	ivaRate: number;
	/** Optional: client-side reviewed flag. Server resets to false when material fields change. */
	isReviewed?: boolean;
	/** Optional: explicit acknowledgment that zero pricing on this line is intentional. */
	isZeroPriceIntentional?: boolean;
}

export interface GetPurchaseOrdersOptions extends PurchaseOrderFilterOptions {
	orderBy?: PurchaseOrderOrderBy;
	orderSort?: 'asc' | 'desc';
	limit?: number;
	offset?: number;
}

export const ORDER_COLUMNS: Record<PurchaseOrderOrderBy, AnyColumn> = {
	orderNumber: purchaseOrders.orderNumber,
	orderDate: purchaseOrders.orderDate,
	createdAt: purchaseOrders.createdAt,
	status: purchaseOrders.status
};
