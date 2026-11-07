/**
 * DTOs and contract types for the Conteo Físico module (rediseño).
 * Split by concern: sessions.ts / lines.ts / shared.ts / coverage.ts / adjustments.ts.
 */
import type {
	InventoryCountScopeDim,
	InventoryCountScopeKind,
	InventoryCountSessionStatus
} from '$lib/schemas/inventoryCount';
import type {
	InventoryCountLine,
	InventoryCountResponsible,
	InventoryCountSession
} from '$lib/server/db/schema';

// ── Responsables ────────────────────────────────────────────────────────────

export interface ResponsibleRow {
	id: number;
	userId: string | null;
	displayName: string;
	isExternal: boolean;
	addedAt: string;
}

/** Entrada del panel de responsables (usuario activo o persona externa). */
export interface ResponsibleEntry {
	userId?: string | null;
	displayName: string;
	isExternal: boolean;
}

// ── Sesiones ───────────────────────────────────────────────────────────────

export interface CountSessionBase extends InventoryCountSession {
	openedByName: string | null;
	appliedByName: string | null;
	cancelledByName: string | null;
}

export interface CountSessionSummary extends CountSessionBase {
	/** Etiqueta legible del alcance (resuelve ids → nombres en server). */
	scopeLabel: string;
	totalLines: number;
	verifiedLines: number;
	pendingLines: number;
	positiveDifferences: number;
	negativeDifferences: number;
	matchedLines: number;
}

export interface CountLineRow extends InventoryCountLine {
	itemId: string;
	itemName: string;
	/** SKU del producto o tipo de lente. */
	itemCode: string | null;
	/** Etiqueta del tipo para agrupar por «Tipo». */
	typeLabel: string;
	brandName: string;
	supplierName: string;
	countedByName: string | null;
	recountedByName: string | null;
	/** Legacy: quién marcó el checkbox «Hecho» antes del rediseño. */
	adjustmentCompletedByName: string | null;
}

export type InventoryCountSessionDetail = CountSessionSummary & {
	responsibles: ResponsibleRow[];
	lines: CountLineRow[];
};

export type CountSessionDetail = InventoryCountSessionDetail;
export type CountLineClient = CountLineRow;

export interface GetSessionsOptions {
	limit?: number;
	status?: InventoryCountSessionStatus;
	openedOn?: string;
}

/** Alcance estructurado de una sesión nueva. */
export interface ScopeSelection {
	kind: InventoryCountScopeKind;
	dim: InventoryCountScopeDim;
	values: string[];
	n: number | null;
}

export interface UpsertCountLineInput {
	sessionId?: number;
	lineId: number;
	countedStock: number;
	userId: string;
	notes?: string | null;
}

export interface RecountLineInput {
	lineId: number;
	recountedStock: number;
	userId: string;
}

export interface CreateCountSessionInput {
	scopeKind: InventoryCountScopeKind;
	scopeDim: InventoryCountScopeDim;
	scopeValues: string[];
	scopeN: number | null;
	notes: string | null;
	openedById: string;
	responsibles: Array<Pick<InventoryCountResponsible, 'userId' | 'displayName' | 'isExternal'>>;
}

// ── Cobertura ──────────────────────────────────────────────────────────────

export interface DiffCostEntry {
	itemType: 'PRODUCT' | 'LENS';
	productId: string | null;
	lensCatalogItemId: string | null;
	fifoCost: number | null;
}
