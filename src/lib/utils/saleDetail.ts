/**
 * Pure helper functions for the sale detail page.
 * No side effects, no reactive state — just classification and display logic.
 */

import type { ChangeHistoryWithUser } from '$lib/server/db/queries/changeHistory';
import { getSaleStatusLabel } from '$lib/shared/enums';

// =============================================================================
// Types
// =============================================================================

export interface AuditEvent {
	id: string;
	label: string;
	changedByName: string | null;
	changedAt: string;
	entityType: string;
	action: string;
}

// =============================================================================
// Audit classification
// =============================================================================

export function classifySaleAuditEntry(entry: ChangeHistoryWithUser): AuditEvent | null {
	const { entityType, action, changes } = entry;

	if (entityType === 'sale') {
		if (action === 'create') {
			return {
				id: entry.id,
				label: 'Venta creada',
				changedByName: entry.changedByName,
				changedAt: entry.changedAt,
				entityType,
				action
			};
		}
		if (action === 'update') {
			if (changes.status) {
				const newStatus = changes.status.new as string | null;
				const label = newStatus ? getSaleStatusLabel(newStatus) : null;
				if (!label) return null;
				return {
					id: entry.id,
					label: `Estado: ${label}`,
					changedByName: entry.changedByName,
					changedAt: entry.changedAt,
					entityType,
					action
				};
			}
			if (changes.customerId) {
				return {
					id: entry.id,
					label: 'Cliente actualizado',
					changedByName: entry.changedByName,
					changedAt: entry.changedAt,
					entityType,
					action
				};
			}
			if (changes.sellerId) {
				return {
					id: entry.id,
					label: 'Vendedor actualizado',
					changedByName: entry.changedByName,
					changedAt: entry.changedAt,
					entityType,
					action
				};
			}
			return {
				id: entry.id,
				label: 'Venta actualizada',
				changedByName: entry.changedByName,
				changedAt: entry.changedAt,
				entityType,
				action
			};
		}
	}

	return null;
}
