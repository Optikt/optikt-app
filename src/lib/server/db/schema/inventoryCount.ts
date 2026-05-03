import {
	pgTable,
	varchar,
	index,
	uniqueIndex,
	serial,
	uuid,
	timestamp,
	integer,
	text,
	foreignKey
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users';
import { products } from './products';
import { lensCatalogItems } from './lenses';

export const inventoryCountSessions = pgTable(
	'inventory_count_sessions',
	{
		id: serial().primaryKey().notNull(),
		status: varchar().notNull(),
		scopeType: varchar('scope_type').notNull(),
		scopeValue: varchar('scope_value'),
		notes: text(),
		openedById: uuid('opened_by_id').notNull(),
		openedAt: timestamp('opened_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
		appliedById: uuid('applied_by_id'),
		appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'string' }),
		cancelledById: uuid('cancelled_by_id'),
		cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
		cancelReason: text('cancel_reason'),
		totalItemsCounted: integer('total_items_counted'),
		totalAdjustmentsIn: integer('total_adjustments_in'),
		totalAdjustmentsOut: integer('total_adjustments_out'),
		totalMatches: integer('total_matches'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_inventory_count_sessions_id').using(
			'btree',
			table.id.asc().nullsLast().op('int4_ops')
		),
		index('ix_inventory_count_sessions_status').using('btree', table.status.asc().nullsLast()),
		uniqueIndex('ux_inventory_count_sessions_open')
			.using('btree', table.status.asc().nullsLast())
			.where(sql`${table.status} = 'OPEN'`),
		foreignKey({
			columns: [table.openedById],
			foreignColumns: [users.id],
			name: 'inventory_count_sessions_opened_by_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.appliedById],
			foreignColumns: [users.id],
			name: 'inventory_count_sessions_applied_by_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.cancelledById],
			foreignColumns: [users.id],
			name: 'inventory_count_sessions_cancelled_by_id_fkey'
		}).onDelete('restrict')
	]
);

export const inventoryCountLines = pgTable(
	'inventory_count_lines',
	{
		id: serial().primaryKey().notNull(),
		sessionId: integer('session_id').notNull(),
		itemType: varchar('item_type').notNull(),
		productId: uuid('product_id'),
		lensCatalogItemId: uuid('lens_catalog_item_id'),
		systemStock: integer('system_stock').notNull(),
		countedStock: integer('counted_stock'),
		difference: integer(),
		countedById: uuid('counted_by_id'),
		countedAt: timestamp('counted_at', { withTimezone: true, mode: 'string' }),
		notes: text(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_inventory_count_lines_id').using('btree', table.id.asc().nullsLast().op('int4_ops')),
		index('ix_inventory_count_lines_session_item_type').using(
			'btree',
			table.sessionId.asc().nullsLast().op('int4_ops'),
			table.itemType.asc().nullsLast()
		),
		index('ix_inventory_count_lines_session_product_id').using(
			'btree',
			table.sessionId.asc().nullsLast().op('int4_ops'),
			table.productId.asc().nullsLast().op('uuid_ops')
		),
		index('ix_inventory_count_lines_session_lens_id').using(
			'btree',
			table.sessionId.asc().nullsLast().op('int4_ops'),
			table.lensCatalogItemId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.sessionId],
			foreignColumns: [inventoryCountSessions.id],
			name: 'inventory_count_lines_session_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: 'inventory_count_lines_product_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.lensCatalogItemId],
			foreignColumns: [lensCatalogItems.id],
			name: 'inventory_count_lines_lens_catalog_item_id_fkey'
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.countedById],
			foreignColumns: [users.id],
			name: 'inventory_count_lines_counted_by_id_fkey'
		}).onDelete('restrict')
	]
);

export type InventoryCountSession = typeof inventoryCountSessions.$inferSelect;
export type NewInventoryCountSession = typeof inventoryCountSessions.$inferInsert;
export type InventoryCountLine = typeof inventoryCountLines.$inferSelect;
export type NewInventoryCountLine = typeof inventoryCountLines.$inferInsert;
