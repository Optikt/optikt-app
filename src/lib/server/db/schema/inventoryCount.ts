import {
	boolean,
	pgTable,
	varchar,
	index,
	uniqueIndex,
	serial,
	uuid,
	timestamp,
	integer,
	doublePrecision,
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
		/**
		 * Alcance estructurado (rediseño): dimensión del alcance.
		 * `ALL` | `BRAND` | `SUPPLIER` | `TYPE` — null en sesiones previas al rediseño.
		 */
		scopeDim: varchar('scope_dim'),
		/** Valores del alcance (ids de marca/proveedor o valores de ProductType). */
		scopeValues: varchar('scope_values').array(),
		/** N del atajo «los más atrasados» cuando aplica. */
		scopeN: integer('scope_n'),
		/** Kind exacto del alcance para etiquetas: ALL|BRAND|SUPPLIER|TYPE|QUICK_OLDEST|QUICK_NEVER. */
		scopeKind: varchar('scope_kind'),
		notes: text(),
		openedById: uuid('opened_by_id').notNull(),
		openedAt: timestamp('opened_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
		appliedById: uuid('applied_by_id'),
		appliedAt: timestamp('applied_at', { withTimezone: true, mode: 'string' }),
		cancelledById: uuid('cancelled_by_id'),
		cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'string' }),
		cancelReason: text('cancel_reason'),
		/** Verificado % del ciclo calculado al abrir la sesión (estable para el informe). */
		coverageBefore: doublePrecision('coverage_before'),
		/** Ítems nunca contados al abrir la sesión. */
		coverageNeverBefore: integer('coverage_never_before'),
		/** Verificado % del ciclo al momento de cerrar (aplicado). */
		coverageAfter: doublePrecision('coverage_after'),
		/** «Nunca contados» al momento de cerrar. */
		coverageNeverAfter: integer('coverage_never_after'),
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
		/** Recuento en la fase Revisar (obligatorio si |dif| ≥ umbral). */
		recountedStock: integer('recounted_stock'),
		recountedById: uuid('recounted_by_id'),
		recountedAt: timestamp('recounted_at', { withTimezone: true, mode: 'string' }),
		/** Movimiento de inventario creado por el ajuste vinculado a esta línea. */
		adjustmentMovementId: uuid('adjustment_movement_id'),
		/** Motivo del ajuste (AdjustmentReason) y texto libre con «OTHER». */
		adjustmentReason: varchar('adjustment_reason'),
		adjustmentReasonText: varchar('adjustment_reason_text'),
		adjustmentCompleted: boolean('adjustment_completed').notNull().default(false),
		adjustmentCompletedById: uuid('adjustment_completed_by_id'),
		adjustmentCompletedAt: timestamp('adjustment_completed_at', {
			withTimezone: true,
			mode: 'string'
		}),
		/** Quién pidió el ajuste en fase Revisar (se ejecuta al cierre). */
		adjustmentRequestedBy: uuid('adjustment_requested_by'),
		/** Cuándo se pidió el ajuste; movimiento = null hasta que se cierra. */
		adjustmentRequestedAt: timestamp('adjustment_requested_at', {
			withTimezone: true,
			mode: 'string'
		}),
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
		}).onDelete('restrict'),
		foreignKey({
			columns: [table.adjustmentCompletedById],
			foreignColumns: [users.id],
			name: 'inventory_count_lines_adjustment_completed_by_id_fkey'
		}).onDelete('restrict')
	]
);

export const inventoryCountResponsibles = pgTable(
	'inventory_count_responsibles',
	{
		id: serial().primaryKey().notNull(),
		sessionId: integer('session_id').notNull(),
		/** Usuario del sistema (puede ver e interactuar) — null para personas externas. */
		userId: uuid('user_id'),
		/** Nombre mostrado: snapshot del usuario o persona externa en texto libre. */
		displayName: varchar('display_name').notNull(),
		/** Externo = solo queda registrada en el informe. */
		isExternal: boolean('is_external').notNull().default(false),
		addedById: uuid('added_by_id'),
		addedAt: timestamp('added_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
		/** Baja lógica: quitar a alguien no borra lo que ya contó. */
		removedAt: timestamp('removed_at', { withTimezone: true, mode: 'string' }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.notNull()
			.defaultNow()
	},
	(table) => [
		index('ix_inventory_count_responsibles_session').using(
			'btree',
			table.sessionId.asc().nullsLast().op('int4_ops'),
			table.removedAt.asc().nullsLast()
		),
		index('ix_inventory_count_responsibles_user').using(
			'btree',
			table.userId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.sessionId],
			foreignColumns: [inventoryCountSessions.id],
			name: 'inventory_count_responsibles_session_id_fkey'
		}).onDelete('cascade'),
		foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: 'inventory_count_responsibles_user_id_fkey'
		}).onDelete('restrict')
	]
);

export type InventoryCountSession = typeof inventoryCountSessions.$inferSelect;
export type NewInventoryCountSession = typeof inventoryCountSessions.$inferInsert;
export type InventoryCountLine = typeof inventoryCountLines.$inferSelect;
export type NewInventoryCountLine = typeof inventoryCountLines.$inferInsert;
export type InventoryCountResponsible = typeof inventoryCountResponsibles.$inferSelect;
export type NewInventoryCountResponsible = typeof inventoryCountResponsibles.$inferInsert;
