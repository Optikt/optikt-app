/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: exported types.
 */

import { type Sale, type SaleItem, type SaleItemFreeDetails } from '$lib/server/db/schema';
import type { SaleStatus } from '$lib/shared/enums';

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
		birthDate: string | null;
		primaryPhone: string;
		gender: string | null;
		address: string | null;
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
	/** Total de ventas no borradas (subtítulo "N ventas registradas") */
	total: number;
	/** Ventas creadas este mes (cualquier estado, sin canceladas incluidas en el conteo) */
	monthly: number;
	/** Suma USD de las ventas de este mes, sin canceladas (KPI "Ventas del mes") */
	monthlyTotalUsd: number;
	pending: number;
	completed: number;
	cancelled: number;
	/** Ventas en READY (KPI "Listas para retirar") */
	ready: number;
	/** Ventas no canceladas con saldo > 0.01 (KPI "Por cobrar") */
	receivableCount: number;
	/** Suma de saldos de esas ventas (KPI "Por cobrar") */
	receivableAmount: number;
}

/** Conteo de ventas agrupado por estado (pestañas facetadas del listado). */
export type SaleStatusCounts = Record<SaleStatus, number>;

/** Suma de TODAS las ventas que cumplen los filtros (no solo la página), sin canceladas. */
export interface SalesSelectionSummary {
	count: number;
	totalUsd: number;
	balanceUsd: number;
}

/** Fila del listado de ventas: agrega flags baratos por ítem para la UI. */
export type SaleListItem = SaleWithRelations & {
	/** ¿Al menos un ítem con envío pendiente de registrar? */
	hasShippingPending: boolean;
	/** ¿Al menos un ítem FREE_ITEM? */
	hasFreeItem: boolean;
};

// ============================================================================
// QUERY OPTIONS
// ============================================================================

/** Sortable sale columns (`balance` = total − paid, canceladas al final) */
export type SaleOrderBy = 'saleDate' | 'orderNumber' | 'total' | 'createdAt' | 'balance';

/** Options for filtering sales (shared between query and count) */
export interface SaleFilterOptions {
	/** Include soft-deleted sales in results (default: false) */
	includeDeleted?: boolean;
	/** Filter by sale statuses (empty/undefined = no filter) */
	statuses?: string[];
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
	/** Filter sales flagged as Cashea (buy-now-pay-later channel) */
	isCashea?: boolean;
	/**
	 * Only non-cancelled sales with outstanding balance > 0.01
	 * (misma tolerancia que `SALE_PAID_EPSILON` en `$lib/shared/saleBalance`).
	 */
	balanceOnly?: boolean;
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
