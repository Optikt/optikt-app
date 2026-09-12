/**
 * Split from parent query module (DT1 phase 4) — logic unchanged, verbatim move: exported types.
 */

import { type InventoryCountLine, type InventoryCountSession } from '$lib/server/db/schema';

export const INVENTORY_COUNT_SESSION_STATUSES = ['OPEN', 'APPLIED', 'CANCELLED'] as const;
export type InventoryCountSessionStatus = (typeof INVENTORY_COUNT_SESSION_STATUSES)[number];

export const INVENTORY_COUNT_SCOPE_TYPES = ['ALL', 'PRODUCT_CATEGORY', 'LENS'] as const;
export type InventoryCountScopeType = (typeof INVENTORY_COUNT_SCOPE_TYPES)[number];

export const INVENTORY_COUNT_LINE_FILTERS = ['ALL', 'COUNTED', 'PENDING', 'WITH_DIFF'] as const;
export type InventoryCountLineFilter = (typeof INVENTORY_COUNT_LINE_FILTERS)[number];

export interface InventoryCountSessionSummary extends InventoryCountSession {
	openedByName: string | null;
	appliedByName: string | null;
	cancelledByName: string | null;
	totalLines: number;
	countedLines: number;
	pendingLines: number;
	positiveDifferences: number;
	negativeDifferences: number;
	matchedLines: number;
}

export interface InventoryCountLineRow extends InventoryCountLine {
	itemId: string;
	itemName: string;
	itemCode: string | null;
	itemDetail: string | null;
	currentStock: number;
	countedByName: string | null;
	adjustmentCompletedByName: string | null;
}

export interface InventoryCountSessionDetail extends InventoryCountSessionSummary {
	lines: InventoryCountLineRow[];
}

export interface InventoryCountSnapshotInput {
	scopeType: InventoryCountScopeType;
	scopeValue?: string | null;
	notes?: string | null;
	openedById: string;
}

export interface GetInventoryCountSessionsOptions {
	limit?: number;
	scopeType?: InventoryCountScopeType;
	openedOn?: string;
}

export interface UpsertCountLineInput {
	sessionId: number;
	itemId: string;
	itemType: 'PRODUCT' | 'LENS';
	countedStock: number;
	userId: string;
	notes?: string | null;
}

export interface SetCountLineAdjustmentStatusInput {
	lineId: number;
	adjustmentCompleted: boolean;
	userId: string;
}
