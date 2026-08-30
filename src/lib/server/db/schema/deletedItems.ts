import {
	pgTable,
	uuid,
	varchar,
	timestamp,
	jsonb,
	uniqueIndex,
	index,
	type AnyPgColumn
} from 'drizzle-orm/pg-core';
import { users } from './users';
import type { EntityType } from './changeHistory';

export type DeletedEntityType = EntityType | 'user';

// ============================================================================
// DELETED ITEMS / TRASH REGISTRY
// ============================================================================

/**
 * Unified soft-delete registry for master-data entities.
 *
 * When an entity is soft-deleted (deleted_at set), a row is written here so the
 * app has one normalized place to list and restore trashed records.
 *
 * `snapshot` stores enough display metadata (label, name, etc.) to render the
 * trash list without UNION queries across every entity table.
 */
export const deletedItems = pgTable(
	'deleted_items',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		entityType: varchar('entity_type').notNull().$type<DeletedEntityType>(),
		entityId: uuid('entity_id').notNull(),
		deletedBy: uuid('deleted_by').references((): AnyPgColumn => users.id, {
			onDelete: 'set null'
		}),
		deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		snapshot: jsonb('snapshot').$type<Record<string, unknown>>(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		uniqueIndex('ix_deleted_items_entity').on(table.entityType, table.entityId),
		index('ix_deleted_items_deleted_at').on(table.entityType, table.deletedAt)
	]
);

export type DeletedItem = typeof deletedItems.$inferSelect;
export type NewDeletedItem = typeof deletedItems.$inferInsert;
