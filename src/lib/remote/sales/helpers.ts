/**
 * Sales remote — shared types
 * Split from sales.remote.ts (DT1 phase 4). Los builders puros
 * (`toSaleTotalsLine`, `resolveLensSnapshotCosts`) viven ahora en
 * `$lib/shared/` — fuente única compartida con quotes (deuda consolidada).
 */

import type {
	SaleWithRelations,
	SaleItemWithDetails,
	SaleListItem,
	SaleStatusCounts,
	SalesSelectionSummary
} from '$lib/server/db/queries/sales/types';

import { type SalePayment } from '$lib/server/db/schema';

// ============================================================================
// TYPES
// ============================================================================

export interface PaginatedSales {
	sales: SaleListItem[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
	facets: SaleStatusCounts;
	selection: SalesSelectionSummary;
}

export type { SalesStats } from '$lib/server/db/queries/sales/types';

import type { SaleItemGroupRecord } from '$lib/server/db/queries/sales/itemGroups';

export interface SaleDetail {
	sale: SaleWithRelations;
	items: SaleItemWithDetails[];
	payments: SalePayment[];
	/** Per-person groups (empty = legacy / ungrouped sale). */
	itemGroups: SaleItemGroupRecord[];
}
