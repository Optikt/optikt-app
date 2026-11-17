/**
 * Pure helper functions for the sale detail page.
 * No side effects, no reactive state — just classification and display logic.
 */

import type { ChangeRecord, FieldChange } from '$lib/server/db/schema';
import { countSaleAuditChanges, SaleAuditDiffSchema } from '$lib/schemas/sales';
import type { SaleAuditDiff } from '$lib/schemas/sales';
import type { ChangeRecord as HistoryChangeRecord } from '$lib/components/history/display-utils';
import { formatChangeValue, getFieldLabel } from '$lib/components/history/display-utils';
import { PAYMENT_METHOD_LABELS, getSaleStatusLabel } from '$lib/shared/enums';
import { formatPrice } from '$lib/utils';

// =============================================================================
// Types
// =============================================================================

export type AuditEventKind = 'create' | 'status' | 'cancel' | 'update' | 'payment' | 'paymentVoid';

/** Drawer filter: Todos = all · Ediciones = updates + payments · Estados = status + cancel. */
export type AuditFilter = 'all' | 'edits' | 'states';

export interface AuditEvent {
	id: string;
	label: string;
	changedByName: string | null;
	changedAt: string;
	entityType: string;
	action: string;
	/** Dot/icon driver: create (navy), status (blue), cancel (red), update (grey), payment (green), paymentVoid (red). */
	kind: AuditEventKind;
	/** Raw field-level changes { field: { old, new } } — null when there is nothing to diff. */
	changes: HistoryChangeRecord | null;
	/** Human reason (cancellation/refund/void) when the audit payload carries one. */
	reason: string | null;
	/** Parsed `itemsDiff` (only sale updates logged with the v1 diff). */
	itemsDiff: SaleAuditDiff | null;
	/**
	 * Update-kind sale event WITHOUT `itemsDiff` = logged before the detailed
	 * record existed → cursive notice, no expandable diff.
	 */
	legacyUpdate: boolean;
	/** Total delta (USD) from the diff; null when the total didn't change. */
	totalDelta: number | null;
	/** Atomic change count (drives «N cambios»). */
	changeCount: number;
	/** BCV USD amount for `sale_payment` events; null otherwise. */
	paymentAmount: number | null;
}

// =============================================================================
// Audit classification
// =============================================================================

function readString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Parse the `itemsDiff` annex of a sale update (`changes.itemsDiff.new`).
 * Returns null for old events (no annex) or malformed payloads.
 */
export function extractSaleAuditDiff(
	changes: ChangeRecord | null | undefined
): SaleAuditDiff | null {
	if (!changes || typeof changes !== 'object') return null;
	const raw = (changes as Record<string, FieldChange | undefined>).itemsDiff;
	if (!raw || typeof raw !== 'object' || !('new' in raw)) return null;
	const parsed = SaleAuditDiffSchema.safeParse(raw.new);
	return parsed.success ? parsed.data : null;
}

/** Total delta (USD) from the diff's TOTALES rows; null when the total didn't move. */
export function saleAuditTotalDelta(diff: SaleAuditDiff | null): number | null {
	if (!diff) return null;
	const row = diff.totals.find((t) => t.label === 'Total');
	if (!row) return null;
	const delta = row.to - row.from;
	return delta === 0 ? 0 : delta;
}

function baseEvent(
	entry: ClassifiableAuditEntry,
	{ label, kind, ...rest }: Pick<AuditEvent, 'label' | 'kind'> & Partial<AuditEvent>
): AuditEvent {
	return {
		id: entry.id,
		label,
		changedByName: entry.changedByName,
		changedAt: entry.changedAt,
		entityType: entry.entityType,
		action: entry.action,
		kind,
		changes: null,
		reason: null,
		itemsDiff: null,
		legacyUpdate: false,
		totalDelta: null,
		changeCount: 0,
		paymentAmount: null,
		...rest
	};
}

/** Minimal shape `classifySaleAuditEntry` reads (loader rows and remote pages alike). */
export interface ClassifiableAuditEntry {
	id: string;
	entityType: string;
	action: string;
	changes: ChangeRecord | null;
	changedAt: string;
	changedByName: string | null;
	reason?: string | null;
}

/** Filter predicate for the drawer pills (Todos / Ediciones / Estados). */
export function matchesAuditFilter(event: AuditEvent, filter: AuditFilter): boolean {
	if (filter === 'all') return true;
	if (filter === 'edits') {
		return event.kind === 'update' || event.kind === 'payment' || event.kind === 'paymentVoid';
	}
	return event.kind === 'status' || event.kind === 'cancel';
}

export function classifySaleAuditEntry(entry: ClassifiableAuditEntry): AuditEvent | null {
	const { entityType, action, changes } = entry;
	if (entityType !== 'sale' && entityType !== 'sale_payment') return null;

	const record = (changes ?? {}) as unknown as HistoryChangeRecord;
	const hasChanges = Object.keys(record).length > 0;

	if (entityType === 'sale_payment') {
		const fields = record as unknown as Record<
			string,
			{ old?: unknown; new?: unknown } | undefined
		>;
		const amount =
			readNumber(fields.amountBcvUsd?.new) ??
			readNumber(fields.amountBcvUsd?.old) ??
			readNumber(fields.amount?.new);
		if (action === 'create') {
			return baseEvent(entry, {
				label: 'Pago registrado',
				kind: 'payment',
				changes: hasChanges ? record : null,
				reason: readString(entry.reason),
				paymentAmount: amount
			});
		}
		if (action === 'update') {
			const voided = fields.voidedAt?.new !== null && fields.voidedAt?.new !== undefined;
			if (voided) {
				return baseEvent(entry, {
					label: 'Pago anulado',
					kind: 'paymentVoid',
					changes: hasChanges ? record : null,
					reason: readString(fields.voidReason?.new) ?? readString(entry.reason),
					paymentAmount: amount
				});
			}
			return null;
		}
		return null;
	}

	if (action === 'create') {
		return baseEvent(entry, {
			label: 'Venta creada',
			kind: 'create',
			changes: null,
			reason: null
		});
	}

	if (action === 'update') {
		const fields = record as Record<string, { new?: unknown } | undefined>;
		if (fields.status) {
			const newStatus = fields.status.new as string | null;
			if (newStatus === 'CANCELLED') {
				return baseEvent(entry, {
					label: 'Venta cancelada',
					kind: 'cancel',
					changes: hasChanges ? record : null,
					reason: readString(fields.cancellationReason?.new)
				});
			}
			const label = newStatus ? getSaleStatusLabel(newStatus) : null;
			if (!label) return null;
			return baseEvent(entry, {
				label: `Estado: ${label}`,
				kind: 'status',
				changes: hasChanges ? record : null,
				reason: null
			});
		}
		const label = fields.customerId
			? 'Cliente actualizado'
			: fields.sellerId
				? 'Vendedor actualizado'
				: 'Venta actualizada';
		const itemsDiff = extractSaleAuditDiff(changes as ChangeRecord);
		return baseEvent(entry, {
			label,
			kind: 'update',
			changes: hasChanges ? record : null,
			reason: readString(entry.reason),
			itemsDiff,
			legacyUpdate: itemsDiff === null,
			totalDelta: saleAuditTotalDelta(itemsDiff),
			changeCount: itemsDiff ? countSaleAuditChanges(itemsDiff) : 0
		});
	}

	return null;
}

// =============================================================================
// Diff detail ("Ver cambios")
// =============================================================================

export interface AuditDiffRow {
	field: string;
	label: string;
	from: string;
	to: string;
}

/**
 * Fields already surfaced as the event title/reason or noise — excluded from
 * the field-by-field diff. Everything else the audit stored is shown as-is.
 */
const DIFF_HIDDEN_FIELDS = new Set([
	'status',
	'cancellationReason',
	'createdAt',
	'updatedAt',
	'deletedAt',
	/** Diff annex itself (rendered as ARTÍCULOS/DATOS/TOTALES sections, never as a row). */
	'itemsDiff'
]);
const MONEY_FIELDS = new Set([
	'subtotal',
	'discount',
	'total',
	'refundAmount',
	'amount',
	'amountBcvUsd'
]);
/**
 * Fields already rendered in the new-style DATOS/TOTALES sections (from
 * `itemsDiff`) — excluded from the legacy rows only when a diff is present.
 */
const DIFF_COVERED_FIELDS = new Set([
	'notes',
	'isCashea',
	'discount',
	'discountType',
	'subtotal',
	'total'
]);
/**
 * `sale_payment` audit rows store raw row fields (ids included) — UUIDs and
 * internal keys are noise next to the payment card, so they never render.
 */
const PAYMENT_HIDDEN_FIELDS = new Set(['id', 'saleId', 'createdById', 'voidedById']);
/** Friendly `rateType` values (same map as the payments drawer). */
const RATE_TYPE_LABELS: Record<string, string> = {
	USDT: 'USDT',
	USD_PAYPAL: 'PayPal',
	EUR_BCV: 'EUR · BCV',
	EUR_EFECTIVO: 'EUR en efectivo',
	USD_EFECTIVO: 'USD en efectivo',
	OTHER: 'Otro'
};

/** Rows for the expandable diff: `Campo: old → new`, formatted for display. */
export function auditDiffRows(event: AuditEvent): AuditDiffRow[] {
	if (!event.changes) return [];
	const isPayment = event.entityType === 'sale_payment';
	const rows: AuditDiffRow[] = [];
	for (const [field, raw] of Object.entries(event.changes)) {
		if (DIFF_HIDDEN_FIELDS.has(field)) continue;
		if (isPayment && PAYMENT_HIDDEN_FIELDS.has(field)) continue;
		if (event.itemsDiff && DIFF_COVERED_FIELDS.has(field)) continue;
		const change = raw as { old?: unknown; new?: unknown };
		const format = (value: unknown): string => {
			if (field === 'paymentMethod' && typeof value === 'string') {
				return (
					PAYMENT_METHOD_LABELS[value as keyof typeof PAYMENT_METHOD_LABELS] ??
					formatChangeValue(value)
				);
			}
			if (field === 'rateType' && typeof value === 'string') {
				return RATE_TYPE_LABELS[value] ?? formatChangeValue(value);
			}
			if (MONEY_FIELDS.has(field) && typeof value === 'number') return formatPrice(value);
			return formatChangeValue(value);
		};
		rows.push({
			field,
			label: getFieldLabel(isPayment ? 'sale_payment' : 'sale', field),
			from: format(change.old),
			to: format(change.new)
		});
	}
	return rows;
}

/** True when the event has something to expand (diff rows, a stored reason, or a parsed itemsDiff). */
export function hasAuditDetail(event: AuditEvent): boolean {
	return (
		event.reason !== null ||
		(event.itemsDiff !== null && countSaleAuditChanges(event.itemsDiff) > 0) ||
		auditDiffRows(event).length > 0
	);
}

/** «N cambios» label for the rail summary line. */
export function auditChangeCountLabel(event: AuditEvent): string {
	if (event.changeCount === 1) return '1 cambio';
	return `${event.changeCount} cambios`;
}
