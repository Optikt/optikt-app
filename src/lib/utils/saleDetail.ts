/**
 * Pure helper functions for the sale detail page.
 * No side effects, no reactive state — just classification and display logic.
 */

import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
import type { ChangeRecord } from '$lib/components/history/display-utils';
import { formatChangeValue, getFieldLabel } from '$lib/components/history/display-utils';
import { getSaleStatusLabel } from '$lib/shared/enums';
import { formatPrice } from '$lib/utils';

// =============================================================================
// Types
// =============================================================================

export type AuditEventKind = 'create' | 'status' | 'cancel' | 'update';

export interface AuditEvent {
	id: string;
	label: string;
	changedByName: string | null;
	changedAt: string;
	entityType: string;
	action: string;
	/** Dot color driver: create (navy), status (blue), cancel (red), update (grey). */
	kind: AuditEventKind;
	/** Raw field-level changes { field: { old, new } } — null when there is nothing to diff. */
	changes: ChangeRecord | null;
	/** Human reason (cancellation/refund) when the audit payload carries one. */
	reason: string | null;
}

// =============================================================================
// Audit classification
// =============================================================================

function readString(value: unknown): string | null {
	return typeof value === 'string' && value.length > 0 ? value : null;
}

export function classifySaleAuditEntry(entry: ChangeHistoryWithUser): AuditEvent | null {
	const { entityType, action, changes } = entry;
	if (entityType !== 'sale') return null;

	const record = (changes ?? {}) as ChangeRecord;
	const hasChanges = Object.keys(record).length > 0;

	if (action === 'create') {
		return {
			id: entry.id,
			label: 'Venta creada',
			changedByName: entry.changedByName,
			changedAt: entry.changedAt,
			entityType,
			action,
			kind: 'create',
			changes: null,
			reason: null
		};
	}

	if (action === 'update') {
		const fields = record as Record<string, { new?: unknown } | undefined>;
		if (fields.status) {
			const newStatus = fields.status.new as string | null;
			if (newStatus === 'CANCELLED') {
				return {
					id: entry.id,
					label: 'Venta cancelada',
					changedByName: entry.changedByName,
					changedAt: entry.changedAt,
					entityType,
					action,
					kind: 'cancel',
					changes: hasChanges ? record : null,
					reason: readString(fields.cancellationReason?.new)
				};
			}
			const label = newStatus ? getSaleStatusLabel(newStatus) : null;
			if (!label) return null;
			return {
				id: entry.id,
				label: `Estado: ${label}`,
				changedByName: entry.changedByName,
				changedAt: entry.changedAt,
				entityType,
				action,
				kind: 'status',
				changes: hasChanges ? record : null,
				reason: null
			};
		}
		const label = fields.customerId
			? 'Cliente actualizado'
			: fields.sellerId
				? 'Vendedor actualizado'
				: 'Venta actualizada';
		return {
			id: entry.id,
			label,
			changedByName: entry.changedByName,
			changedAt: entry.changedAt,
			entityType,
			action,
			kind: 'update',
			changes: hasChanges ? record : null,
			reason: null
		};
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
	'deletedAt'
]);
const MONEY_FIELDS = new Set(['subtotal', 'discount', 'total', 'refundAmount']);

/** Rows for the expandable diff: `Campo: old → new`, formatted for display. */
export function auditDiffRows(event: AuditEvent): AuditDiffRow[] {
	if (!event.changes) return [];
	const rows: AuditDiffRow[] = [];
	for (const [field, raw] of Object.entries(event.changes)) {
		if (DIFF_HIDDEN_FIELDS.has(field)) continue;
		const change = raw as { old?: unknown; new?: unknown };
		const format = (value: unknown): string => {
			if (MONEY_FIELDS.has(field) && typeof value === 'number') return formatPrice(value);
			return formatChangeValue(value);
		};
		rows.push({
			field,
			label: getFieldLabel('sale', field),
			from: format(change.old),
			to: format(change.new)
		});
	}
	return rows;
}

/** True when the event has something to expand (diff rows or a stored reason). */
export function hasAuditDetail(event: AuditEvent): boolean {
	return event.reason !== null || auditDiffRows(event).length > 0;
}
