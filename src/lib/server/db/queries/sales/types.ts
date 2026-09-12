/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: exported types.
 */

import { type Sale, type SaleItem, type SaleItemFreeDetails } from '$lib/server/db/schema';

// ============================================================================
// TYPES
// ============================================================================

export type SaleWithRelations = Sale & {
	/** Alias sourced from createdAt (single date truth) — keeps UI domain language. */
	saleDate: string;
	customer: {
		id: string;
		firstName: string;
		lastName: string;
		idNumber: string | null;
		primaryPhone: string;
	} | null;
	seller: { id: string; fullName: string } | null;
	cancelledBy: { id: string; fullName: string } | null;
	refundedBy: { id: string; fullName: string } | null;
};

export type SaleItemWithDetails = SaleItem & {
	product: { id: string; name: string; sku: string } | null;
	lensCatalogItem: { id: string; name: string; type: string } | null;
	supplierTreatment: { id: string; name: string; category: string } | null;
	freeDetails: SaleItemFreeDetails | null;
};

export interface SalesStats {
	monthly: number;
	pending: number;
	completed: number;
	cancelled: number;
}

// ============================================================================
// QUERY OPTIONS
// ============================================================================

/** Sortable sale columns */
export type SaleOrderBy = 'saleDate' | 'orderNumber' | 'total' | 'createdAt';

/** Options for filtering sales (shared between query and count) */
export interface SaleFilterOptions {
	/** Include soft-deleted sales in results (default: false) */
	includeDeleted?: boolean;
	/** Filter by sale status */
	status?: string;
	/** Filter by customer ID */
	customerId?: string;
	/** Filter by seller ID */
	sellerId?: string;
	/** Filter by date range start (ISO string) */
	dateFrom?: string;
	/** Filter by date range end (ISO string, inclusive - expanded to end of day) */
	dateTo?: string;
	/** Search by customer name, ID number, or seller name (case-insensitive) */
	search?: string;
	/** Filter sales that have at least one item with shippingCostPending = true */
	shippingCostPending?: boolean;
	/** Filter sales that have at least one FREE_ITEM */
	hasFreeItem?: boolean;
}

/** Options for querying sales with relations */
export interface GetSalesOptions extends SaleFilterOptions {
	/** Column to order by (default: 'saleDate') */
	orderBy?: SaleOrderBy;
	/** Sort direction (default: 'desc') */
	orderSort?: 'asc' | 'desc';
	/** Maximum number of results to return */
	limit?: number;
	/** Number of results to skip (for pagination) */
	offset?: number;
}
