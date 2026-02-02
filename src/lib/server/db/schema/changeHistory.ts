import {
	pgTable,
	uuid,
	varchar,
	timestamp,
	jsonb,
	index,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { users } from './users';

// ============================================================================
// CHANGE HISTORY / AUDIT LOG
// ============================================================================

/**
 * Change history table for tracking modifications to entities.
 * Stores field-level changes and optional full snapshots.
 */
export const changeHistory = pgTable(
	'change_history',
	{
		id: uuid('id').primaryKey().defaultRandom(),

		// Entity identification
		entityType: varchar('entity_type').notNull(), // 'product', 'customer', 'prescription', 'sale', etc.
		entityId: uuid('entity_id').notNull(), // The ID of the changed record

		// Change metadata
		action: varchar('action').notNull(), // 'create', 'update', 'delete', 'restore'
		changedAt: timestamp('changed_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
		changedById: uuid('changed_by_id').references((): AnyPgColumn => users.id, {
			onDelete: 'set null'
		}),

		// Change details
		changes: jsonb('changes').notNull().$type<ChangeRecord>(), // { field: { old: value, new: value } }
		snapshot: jsonb('snapshot').$type<Record<string, unknown>>(), // Full entity state before change

		// Context
		reason: varchar('reason'),
		ipAddress: varchar('ip_address', { length: 45 }),
		userAgent: varchar('user_agent', { length: 255 }),

		// Timestamps
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
	},
	(table) => [
		index('ix_change_history_entity').on(table.entityType, table.entityId),
		index('ix_change_history_changed_at').on(table.changedAt),
		index('ix_change_history_changed_by').on(table.changedById),
		index('ix_change_history_action').on(table.action)
	]
);

// ============================================================================
// TYPES
// ============================================================================

export type EntityType =
	| 'product'
	| 'customer'
	| 'prescription'
	| 'sale'
	| 'sale_item'
	| 'lens_catalog_item'
	| 'supplier'
	| 'brand'
	| 'material'
	| 'lens_material'
	| 'lens_treatment';

export type ActionType = 'create' | 'update' | 'delete' | 'restore';

export interface FieldChange<T = unknown> {
	old: T | null;
	new: T | null;
}

export interface ChangeRecord {
	[field: string]: FieldChange;
}

export type ChangeHistory = typeof changeHistory.$inferSelect;
export type NewChangeHistory = typeof changeHistory.$inferInsert;
