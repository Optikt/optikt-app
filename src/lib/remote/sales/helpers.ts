/**
 * Sales remote — shared types + builders
 * Split from sales.remote.ts (DT1 phase 4) — logic unchanged, verbatim move.
 */

import type { SaleWithRelations, SaleItemWithDetails } from '$lib/server/db/queries/sales';

import { type SalePayment } from '$lib/server/db/schema';

import { SaleItemType } from '$lib/shared/enums/lensTypes';

import { computeLensSnapshotCostTotal, computeSnapshotCostUnit } from '$lib/shared/saleItemCosts';
import { type SaleTotalsLine } from '$lib/shared/saleTotals';

// ============================================================================
// TYPES
// ============================================================================

export interface PaginatedSales {
	sales: SaleWithRelations[];
	total: number;
	page: number;
	perPage: number;
	totalPages: number;
}

export type { SalesStats } from '$lib/server/db/queries/sales';

export interface SaleDetail {
	sale: SaleWithRelations;
	items: SaleItemWithDetails[];
	payments: SalePayment[];
}

export function resolveLensSnapshotCosts(item: {
	itemType: string;
	quantity: number;
	snapshotBaseCost?: number | null;
	snapshotMountingPrice?: number | null;
	snapshotShippingPrice?: number | null;
	shippingCostPending?: boolean | null;
}): { snapshotCostTotal: number | null; snapshotCostUnit: number | null } {
	if (item.itemType !== SaleItemType.LENS_PAIR) {
		return { snapshotCostTotal: null, snapshotCostUnit: null };
	}

	const snapshotCostTotal = computeLensSnapshotCostTotal({
		snapshotBaseCost: item.snapshotBaseCost,
		snapshotMountingPrice: item.snapshotMountingPrice,
		snapshotShippingPrice: item.snapshotShippingPrice,
		shippingCostPending: item.shippingCostPending
	});

	return {
		snapshotCostTotal,
		snapshotCostUnit: computeSnapshotCostUnit(snapshotCostTotal, item.quantity)
	};
}

export function toSaleTotalsLine(
	item: {
		unitPrice: number;
		quantity: number;
		discount: number;
		discountType: string;
		snapshotIsTaxable?: boolean | null;
		itemType: string;
	},
	taxRate: number
): SaleTotalsLine {
	return {
		unitPrice: item.unitPrice,
		quantity: item.quantity,
		discount: item.discount,
		discountType: item.discountType,
		isTaxable: item.snapshotIsTaxable ?? (item.itemType === SaleItemType.PRODUCT ? true : false),
		taxRate
	};
}
